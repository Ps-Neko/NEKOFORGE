/**
 * Worker result import + list/show (Phase WF).
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { StageDeps } from "../core/stage-runner.js";
import { isoNow } from "../utils/time.js";
import { WorkersError } from "./index.js";
import { detectForbiddenActions } from "./validate.js";

export interface WorkerResultJson {
  schemaVersion: "0.5";
  taskId: string;
  workerId: string;
  role: string;
  status: "completed" | "failed" | "skipped" | "needs_input";
  summary?: string;
  findings?: Array<{
    severity: "info" | "warning" | "high" | "critical";
    title: string;
    detail?: string;
    file?: string;
    line?: number;
  }>;
  evidence?: { prompt?: string; result?: string };
  forbiddenActionsDeclared?: string[];
  generatedAt?: string;
}

export interface ImportInput {
  taskId: string;
  worker: string;
  file: string;
  /** result.json 도 같이 import. 없으면 markdown body 만 저장 후 minimal json 생성. */
  jsonFile?: string;
}

export async function importWorkerResult(
  input: ImportInput,
  deps: StageDeps
): Promise<{ resultMdPath: string; resultJsonPath: string }> {
  const body = await readFile(input.file, "utf8");
  const at = isoNow(deps.clock);

  const mdRel = `worker-runs/${input.taskId}/${input.worker}.result.md`;
  await deps.artifact.writeMarkdown(mdRel, body);

  let resultJson: WorkerResultJson;
  if (input.jsonFile) {
    const raw = await readFile(input.jsonFile, "utf8");
    resultJson = JSON.parse(raw) as WorkerResultJson;
    if (resultJson.taskId !== input.taskId) {
      throw new WorkersError(
        `result.json.taskId="${resultJson.taskId}" but --task-id="${input.taskId}"`
      );
    }
    if (resultJson.role !== input.worker) {
      throw new WorkersError(
        `result.json.role="${resultJson.role}" but --worker="${input.worker}"`
      );
    }
  } else {
    resultJson = {
      schemaVersion: "0.5",
      taskId: input.taskId,
      workerId: input.worker,
      role: input.worker,
      status: "completed",
      summary: "(imported from markdown — no structured json provided)",
      findings: [],
      forbiddenActionsDeclared: ["no-commit", "no-push", "no-deploy", "no-apply"],
      generatedAt: at
    };
  }

  // worker-safety check — body 에 forbidden 패턴 있으면 critical finding 자동 추가.
  const hits = detectForbiddenActions(body);
  if (hits.length > 0) {
    const enriched = [...(resultJson.findings ?? [])];
    for (const h of hits) {
      enriched.push({
        severity: "critical",
        title: `worker forbidden action declared in result: ${h.rule}`,
        detail: `pattern: ${h.match}`
      });
    }
    resultJson = { ...resultJson, findings: enriched };
  }

  const jsonRel = `worker-runs/${input.taskId}/${input.worker}.result.json`;
  await deps.artifact.writeJson(jsonRel, resultJson, "worker-result");

  return {
    resultMdPath: `.harness/${mdRel}`,
    resultJsonPath: `.harness/${jsonRel}`
  };
}

export interface ListInput {
  taskId: string;
}

export async function listWorkerResults(
  input: ListInput,
  deps: StageDeps
): Promise<Array<{ worker: string; hasMd: boolean; hasJson: boolean }>> {
  const dir = join(deps.cwd, ".harness", "worker-runs", input.taskId);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const byWorker = new Map<string, { hasMd: boolean; hasJson: boolean }>();
  for (const f of entries) {
    const mdMatch = /^(.+)\.result\.md$/.exec(f);
    const jsonMatch = /^(.+)\.result\.json$/.exec(f);
    if (mdMatch?.[1]) {
      const w = mdMatch[1];
      const cur = byWorker.get(w) ?? { hasMd: false, hasJson: false };
      byWorker.set(w, { ...cur, hasMd: true });
    }
    if (jsonMatch?.[1]) {
      const w = jsonMatch[1];
      const cur = byWorker.get(w) ?? { hasMd: false, hasJson: false };
      byWorker.set(w, { ...cur, hasJson: true });
    }
  }
  return [...byWorker.entries()].map(([worker, v]) => ({ worker, ...v }));
}

export async function showWorkerResult(
  taskId: string,
  worker: string,
  deps: StageDeps
): Promise<{ md: string | null; json: WorkerResultJson | null }> {
  const md = await deps.artifact.readMarkdown(
    `worker-runs/${taskId}/${worker}.result.md`
  );
  const json = await deps.artifact
    .readJson<WorkerResultJson>(`worker-runs/${taskId}/${worker}.result.json`)
    .catch(() => null);
  return { md, json };
}

/**
 * gate 가 호출 — 한 task 의 모든 worker-result.json 을 모아서 집계.
 */
export async function collectTaskWorkerResults(
  taskId: string,
  deps: StageDeps
): Promise<WorkerResultJson[]> {
  const list = await listWorkerResults({ taskId }, deps);
  const out: WorkerResultJson[] = [];
  for (const { worker, hasJson } of list) {
    if (!hasJson) continue;
    const json = await deps.artifact
      .readJson<WorkerResultJson>(
        `worker-runs/${taskId}/${worker}.result.json`
      )
      .catch(() => null);
    if (json) out.push(json);
  }
  return out;
}

/**
 * Phase WF-2 — worker-result validate.
 * required worker / schema / forbidden action / role consistency / finding 카운트.
 */
export interface ValidateResult {
  taskId: string;
  ok: boolean;
  checks: Array<{ id: string; status: "ok" | "warn" | "fail"; message: string }>;
  summary: { ok: number; warn: number; fail: number };
}

export async function validateWorkerResults(
  taskId: string,
  requiredRoles: ReadonlyArray<string>,
  deps: StageDeps
): Promise<ValidateResult> {
  const checks: ValidateResult["checks"] = [];
  const list = await listWorkerResults({ taskId }, deps);
  const byRole = new Map(list.map((r) => [r.worker, r]));

  for (const role of requiredRoles) {
    const entry = byRole.get(role);
    if (!entry) {
      checks.push({
        id: `required:${role}`,
        status: "fail",
        message: `worker-result missing for ${role}`
      });
      continue;
    }
    if (!entry.hasJson) {
      checks.push({
        id: `required:${role}`,
        status: "fail",
        message: `${role}.result.json missing (only .md present)`
      });
      continue;
    }
    const json = await deps.artifact
      .readJson<WorkerResultJson>(
        `worker-runs/${taskId}/${role}.result.json`,
        "worker-result"
      )
      .catch(() => null);
    if (!json) {
      checks.push({
        id: `schema:${role}`,
        status: "fail",
        message: `${role}.result.json schema invalid`
      });
      continue;
    }
    if (json.role !== role) {
      checks.push({
        id: `role-mismatch:${role}`,
        status: "fail",
        message: `result.json.role="${json.role}" but file name implies "${role}"`
      });
    }
    const findings = json.findings ?? [];
    const critical = findings.filter((f) => f.severity === "critical").length;
    const high = findings.filter((f) => f.severity === "high").length;
    if (critical > 0) {
      checks.push({
        id: `critical:${role}`,
        status: "fail",
        message: `${critical} critical finding(s) in ${role}`
      });
    } else if (high > 0) {
      checks.push({
        id: `high:${role}`,
        status: "warn",
        message: `${high} high finding(s) in ${role}`
      });
    } else {
      checks.push({
        id: `required:${role}`,
        status: "ok",
        message: `${role}.result.json valid`
      });
    }
    if (json.evidence?.result) {
      const rel = json.evidence.result.replace(/^\.harness\//, "");
      const hasResultMd = await deps.artifact.exists(rel);
      if (!hasResultMd) {
        checks.push({
          id: `evidence:${role}`,
          status: "warn",
          message: `evidence.result file not found: ${json.evidence.result}`
        });
      }
    }
  }

  const summary = checks.reduce(
    (acc, c) => ({ ...acc, [c.status]: acc[c.status] + 1 }),
    { ok: 0, warn: 0, fail: 0 }
  );
  return { taskId, ok: summary.fail === 0, checks, summary };
}

export function renderValidateMd(r: ValidateResult): string {
  const lines: string[] = [
    `# Worker Result Validation — ${r.taskId}`,
    "",
    `- ok: ${r.summary.ok}`,
    `- warn: ${r.summary.warn}`,
    `- fail: ${r.summary.fail}`,
    "",
    "## Checks",
    ""
  ];
  for (const c of r.checks) {
    const icon = c.status === "ok" ? "✓" : c.status === "warn" ? "!" : "✗";
    lines.push(`- [${icon}] ${c.id}: ${c.message}`);
  }
  return lines.join("\n");
}
