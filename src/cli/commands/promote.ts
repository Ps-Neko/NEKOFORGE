import type { Command } from "commander";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { buildDeps } from "../../core/stage-runner.js";
import { runStage } from "./_run.js";
import { isoNow } from "../../utils/time.js";
import {
  loadCandidateRule, computeFixturesHash, validateMinFixtures, verifyFixturesHash
} from "../../core/promotion/candidate.js";
import { runTrial } from "../../core/promotion/trial.js";
import { loadActiveRules } from "../../core/promotion/promoted.js";
import { validateExperiences } from "../../core/promotion/experience.js";
import {
  submitCandidate, approveCandidate, rejectCandidate, readPromotedManifest
} from "../../core/promotion/store.js";
import type { CandidateDef, TrialRecord } from "../../core/promotion/store-types.js";
import { SKILL_PACK_CATALOG, type SkillPackDef } from "../../skill-packs/catalog.js";
import {
  validateSkillPackCandidate, submitSkillPack, approveSkillPack, rejectSkillPack,
  type SkillPackCandidate
} from "../../core/promotion/skill-pack.js";
import { readPromotedSkillPacks } from "../../skill-packs/promoted.js";

export function registerPromote(program: Command): void {
  const cmd = program
    .command("promote")
    .description("Promotion gate: 후보 rule 제출/시험/승인 채용 (submit/trial/report/approve/reject/list)");

  cmd.command("submit")
    .description("후보 rule 제출 (candidate.json + fixtures 봉인)")
    .argument("<id>", "promotion id")
    .requiredOption("--module <path>", "후보 rule 모듈 경로")
    .requiredOption("--export <name>", "DeterministicRule export 이름")
    .requiredOption("--fixtures <dir>", "검증용 fixtures 디렉토리(<group>/<scenario>/expected.json)")
    .option("--experience <id>", "동기가 된 eval-case id (반복 가능)", (v: string, prev: string[]) => prev.concat([v]), [] as string[])
    .action(async (id: string, o: { module: string; export: string; fixtures: string; experience: string[] }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const experiences = [...new Set(o.experience)];
        const expCheck = await validateExperiences(
          experiences,
          (eid) => deps.artifact.readJson<{ kind: string }>(`eval-cases/${eid}.json`)
        );
        if (!expCheck.ok) { const e = new Error(`INVALID_EXPERIENCE: ${expCheck.reason}`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        const cand: CandidateDef = {
          id, kind: "rule", modulePath: resolve(o.module), exportName: o.export, submittedAt: isoNow(),
          ...(experiences.length > 0 ? { experiences } : {})
        };
        const { files, verdicts } = await readFixtures(resolve(o.fixtures));
        const min = validateMinFixtures(verdicts);
        if (!min.ok) { const e = new Error(`INSUFFICIENT_EVIDENCE: ${min.reason}`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        await submitCandidate(deps.artifact, cand);
        await deps.artifact.writeJson(`promotions/${id}/fixtures-hash.json`, {
          fixturesHash: computeFixturesHash(cand, files)
        });
        return id;
      }, (id) => console.error(`[ok] submitted: ${id}`));
    });

  cmd.command("trial")
    .description("baseline(현 채용분 포함) vs candidate 시험 → trial.json")
    .argument("<id>", "promotion id")
    .requiredOption("--fixtures <dir>", "fixtures 디렉토리")
    .action(async (id: string, o: { fixtures: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const cand = await deps.artifact.readJson<CandidateDef>(`promotions/${id}/candidate.json`);
        if (!cand) { const e = new Error(`${id} 미제출`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        // §8-2 동일조건 강제: trial 시점 fixtures 를 재해싱해 submit 봉인값과 대조(불일치=무효).
        const stored = (await deps.artifact.readJson<{ fixturesHash: string }>(`promotions/${id}/fixtures-hash.json`))?.fixturesHash ?? "";
        const { files } = await readFixtures(resolve(o.fixtures));
        const fxCheck = verifyFixturesHash(stored, cand, files);
        if (!fxCheck.ok) { const e = new Error(`INVALID_TRIAL: ${fxCheck.reason}`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        const rule = await loadCandidateRule(cand);
        const readManifest = async () => readPromotedManifest(deps.artifact);
        const active = await loadActiveRules(readManifest);
        const t = await runTrial(resolve(o.fixtures), [rule], { activeBaseline: active });
        const rec: TrialRecord = {
          baseline: pick(t.baseline), candidate: pick(t.candidate),
          verdict: t.decision.verdict, reasons: t.decision.reasons,
          fixturesHash: fxCheck.actual,
          ranAt: isoNow()
        };
        await deps.artifact.writeJson(`promotions/${id}/trial.json`, rec);
        return rec.verdict;
      }, (v) => console.error(`[ok] trial verdict: ${v}`));
    });

  cmd.command("report")
    .description("REPORT.md 출력")
    .argument("<id>", "promotion id")
    .action(async (id: string) => {
      await runStage(async () => {
        const deps = buildDeps();
        const t = await deps.artifact.readJson<TrialRecord>(`promotions/${id}/trial.json`);
        if (!t) { const e = new Error(`${id} trial 없음`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        const md = [
          `# Promotion Report — ${id}`, "",
          `- verdict: **${t.verdict}**`,
          `- recall: ${t.baseline.criticalRecall.toFixed(3)} -> ${t.candidate.criticalRecall.toFixed(3)}`,
          `- fpRate: ${t.baseline.falsePositiveRate.toFixed(3)} -> ${t.candidate.falsePositiveRate.toFixed(3)}`,
          `- fixturesHash: ${t.fixturesHash}`, "",
          ...t.reasons.map((r) => `- ${r}`)
        ].join("\n");
        await deps.artifact.writeMarkdown(`promotions/${id}/REPORT.md`, md + "\n");
        return md;
      }, (md) => console.error(md));
    });

  cmd.command("approve")
    .description("사람 승인 → 자동 채용(promoted.json) + ledger")
    .argument("<id>", "promotion id")
    .requiredOption("--approved", "명시 승인 도장")
    .option("--by <who>", "승인자", "local")
    .action(async (id: string, o: { by: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const { decision } = await approveCandidate(deps.artifact, id, { approvedBy: o.by, clockNow: isoNow() });
        return decision.verdict;
      }, (v) => console.error(`[ok] ${v} — 카탈로그 채용 완료 (promoted.json + ledger)`));
    });

  cmd.command("reject")
    .description("명시 거절 → rejected 기록")
    .argument("<id>", "promotion id")
    .option("--reason <text>", "사유", "rejected by human")
    .action(async (id: string, o: { reason: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        await rejectCandidate(deps.artifact, id, o.reason, isoNow());
        return id;
      }, (id) => console.error(`[ok] rejected: ${id}`));
    });

  cmd.command("list")
    .description("채용된 rule 목록(promoted.json)")
    .action(async () => {
      await runStage(async () => {
        const deps = buildDeps();
        const m = await readPromotedManifest(deps.artifact);
        return m.rules;
      }, (rules) => {
        if (rules.length === 0) console.error("(채용 없음)");
        for (const r of rules) console.error(`- ${r.id} (${r.modulePath}#${r.exportName}) @${r.promotedAt}${r.experiences?.length ? ` exp=[${r.experiences.join(",")}]` : ""}`);
      });
    });

  cmd.command("submit-pack")
    .description("skill-pack 후보 제출 (JSON 파일 + 사람 검토 승격)")
    .argument("<id>", "promotion id")
    .requiredOption("--pack-file <path>", "SkillPackDef JSON ({id, appliesTo, guidance[]})")
    .option("--experience <id>", "동기가 된 eval-case id (반복 가능)", (v: string, prev: string[]) => prev.concat([v]), [] as string[])
    .action(async (id: string, o: { packFile: string; experience: string[] }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const raw = JSON.parse(await readFile(resolve(o.packFile), "utf8")) as Partial<SkillPackDef>;
        const builtinIds = new Set(SKILL_PACK_CATALOG.map((p) => p.id));
        const v = validateSkillPackCandidate(raw, builtinIds);
        if (!v.ok) { const e = new Error(`INVALID_SKILL_PACK: ${v.reason}`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        const experiences = [...new Set(o.experience)];
        const expCheck = await validateExperiences(experiences, (eid) => deps.artifact.readJson<{ kind: string }>(`eval-cases/${eid}.json`));
        if (!expCheck.ok) { const e = new Error(`INVALID_EXPERIENCE: ${expCheck.reason}`); (e as Error & { exitCode?: number }).exitCode = 4; throw e; }
        const cand: SkillPackCandidate = {
          id, appliesTo: raw.appliesTo!, guidance: raw.guidance!, submittedAt: isoNow(),
          ...(experiences.length > 0 ? { experiences } : {})
        };
        await submitSkillPack(deps.artifact, cand);
        return id;
      }, (id) => console.error(`[ok] skill-pack submitted: ${id}`));
    });

  cmd.command("approve-pack")
    .description("사람 승인 → skill-pack 카탈로그 채용(promoted-skill-packs.json) + ledger")
    .argument("<id>", "promotion id")
    .requiredOption("--approved", "명시 승인 도장")
    .option("--by <who>", "승인자", "local")
    .action(async (id: string, o: { by: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        const { entry } = await approveSkillPack(deps.artifact, id, { approvedBy: o.by, clockNow: isoNow() });
        return entry.id;
      }, (pid) => console.error(`[ok] approved skill-pack: ${pid} (promoted-skill-packs.json + ledger)`));
    });

  cmd.command("reject-pack")
    .description("명시 거절 → rejected 기록")
    .argument("<id>", "promotion id")
    .option("--reason <text>", "사유", "rejected by human")
    .action(async (id: string, o: { reason: string }) => {
      await runStage(async () => {
        const deps = buildDeps();
        await rejectSkillPack(deps.artifact, id, o.reason, isoNow());
        return id;
      }, (id) => console.error(`[ok] rejected skill-pack: ${id}`));
    });

  cmd.command("list-packs")
    .description("채용된 skill-pack 목록(promoted-skill-packs.json)")
    .action(async () => {
      await runStage(async () => {
        const deps = buildDeps();
        return (await readPromotedSkillPacks(deps.artifact)).packs;
      }, (packs) => {
        if (packs.length === 0) console.error("(채용 skill-pack 없음)");
        for (const p of packs) console.error(`- ${p.id} (${p.appliesTo}) @${p.promotedAt}${p.experiences?.length ? ` exp=[${p.experiences.join(",")}]` : ""}`);
      });
    });
}

function pick(r: { criticalRecall: number; falsePositiveRate: number; totalScenarios: number }) {
  return { criticalRecall: r.criticalRecall, falsePositiveRate: r.falsePositiveRate, totalScenarios: r.totalScenarios };
}

async function readFixtures(root: string): Promise<{ files: Record<string, string>; verdicts: string[] }> {
  const files: Record<string, string> = {};
  const verdicts: string[] = [];
  const groups = await readdir(root).catch(() => [] as string[]);
  for (const g of groups) {
    const scenarios = await readdir(join(root, g)).catch(() => [] as string[]);
    for (const s of scenarios) {
      const exp = join(root, g, s, "expected.json");
      try {
        const text = await readFile(exp, "utf8");
        files[`${g}/${s}/expected.json`] = text;
        verdicts.push((JSON.parse(text) as { verdict?: string }).verdict ?? "");
        const patch = join(root, g, s, "last-diff.patch");
        files[`${g}/${s}/last-diff.patch`] = await readFile(patch, "utf8").catch(() => "");
      } catch { /* skip */ }
    }
  }
  return { files, verdicts };
}
