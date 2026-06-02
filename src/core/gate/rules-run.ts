/**
 * gate rule 실행 보조 — core rule 순회 + 채용(promoted) rule 동적 로딩.
 *
 * gate/index.ts 에서 분리(Step 1 모듈화). runGate 가 import 해 사용한다.
 * promotion/ 은 채용 rule 의 공유 소스(leaf)라 import 가능(ARCHITECTURE §7).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  ALL_RULES,
  type RuleContext,
  type RuleFinding
} from "../../rules/index.js";
import { harnessRoot } from "../../utils/paths.js";
import { loadPromotedRules } from "../promotion/promoted.js";
import type { PromotedManifest } from "../promotion/store-types.js";

export async function runAllRules(ctx: RuleContext, cwd: string): Promise<RuleFinding[]> {
  const out: RuleFinding[] = [];
  const rules = [...ALL_RULES, ...(await loadPromotedForCwd(cwd))];
  for (const r of rules) {
    const fs = await r.run(ctx);
    out.push(...fs);
  }
  return out;
}

export async function runAllRulesExceptCodex(ctx: RuleContext, cwd: string): Promise<RuleFinding[]> {
  const out: RuleFinding[] = [];
  const rules = [...ALL_RULES, ...(await loadPromotedForCwd(cwd))];
  for (const r of rules) {
    if (r.id === "codex-missing-risk") continue;
    if (r.id === "auto-apply-block") continue;
    const fs = await r.run(ctx);
    out.push(...fs);
  }
  return out;
}

/** cwd 기준 promoted.json 을 읽어 매니페스트로(없으면 null). */
async function readPromotedManifestAt(cwd: string): Promise<PromotedManifest | null> {
  try {
    const text = await readFile(join(harnessRoot(cwd), "promotions", "promoted.json"), "utf8");
    return JSON.parse(text) as PromotedManifest;
  } catch {
    return null;
  }
}

/** 현 cwd 기준 채용분 rule(런타임 동적 로딩). gate 의 rule 순회에 합류. */
export async function loadPromotedForCwd(cwd: string) {
  return loadPromotedRules(() => readPromotedManifestAt(cwd));
}

/** 테스트/관측용: 활성 rule id 목록(ALL_RULES + promoted). */
export async function collectActiveRuleIds(cwd: string): Promise<string[]> {
  const promoted = await loadPromotedForCwd(cwd);
  return [...ALL_RULES.map((r) => r.id), ...promoted.map((r) => r.id)];
}

export function deriveHighRiskFlags(findings: readonly RuleFinding[]): NonNullable<RuleContext["highRiskFlags"]> {
  return {
    dangerousFileWrite: findings.some((f) => f.ruleId === "dangerous-file-write"),
    authBypass: findings.some((f) => f.ruleId === "auth-bypass"),
    secretFallback: findings.some((f) => f.ruleId === "secret-fallback"),
    hookInjection: findings.some((f) => f.ruleId === "hook-injection-risk"),
    agentPermissionExpansion: findings.some(
      (f) => f.ruleId === "agent-permission-risk"
    ),
    testDeletion: findings.some((f) => f.ruleId === "test-deletion")
  };
}

export function uniqueRuleIds(findings: readonly RuleFinding[]): string[] {
  return Array.from(
    new Set(findings.filter((f) => f.severity !== "info").map((f) => f.ruleId))
  );
}
