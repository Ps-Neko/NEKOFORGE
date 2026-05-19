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
