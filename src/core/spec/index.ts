import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import type { StageDeps } from "../stage-runner.js";

const QUESTIONS = [
  { id: "who", title: "누가 쓰는가?" },
  { id: "why", title: "왜 필요한가?" },
  { id: "problemIfMissing", title: "없으면 어떤 문제가 생기는가?" },
  { id: "coreFeatures", title: "핵심 기능은 무엇인가?" },
  { id: "notDoing", title: "이번 버전에서 하지 않을 것은 무엇인가?" },
  { id: "successCriteria", title: "성공 기준은 무엇인가?" },
  { id: "failureCriteria", title: "실패 기준은 무엇인가?" }
] as const;

export interface SpecAnswers {
  [key: string]: string;
}

export interface SpecInput {
  answersFile?: string;
  answers?: SpecAnswers;
  nonInteractive?: boolean;
}

export interface SpecResult {
  path: string;
  answeredCount: number;
}

const REJECT_VALUES = new Set(["", "tbd", "?", "추후 결정", "todo"]);

export class SpecPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`spec stage requires ${missing}`);
    this.name = "SpecPrecondError";
  }
}

export class SpecLintError extends Error {
  readonly exitCode = 1;
  constructor(message: string) {
    super(message);
    this.name = "SpecLintError";
  }
}

function lintAnswers(answers: SpecAnswers): void {
  for (const q of QUESTIONS) {
    const val = (answers[q.id] ?? "").trim();
    if (val.length === 0 || REJECT_VALUES.has(val.toLowerCase())) {
      throw new SpecLintError(
        `spec answer for "${q.id}" is empty or placeholder (got: "${val}")`
      );
    }
  }
}

async function loadAnswers(input: SpecInput, cwd: string): Promise<SpecAnswers> {
  if (input.answers) return input.answers;
  if (input.answersFile) {
    const text = await readFile(resolve(cwd, input.answersFile), "utf8");
    return JSON.parse(text) as SpecAnswers;
  }
  if (input.nonInteractive) {
    throw new SpecLintError(
      "non-interactive mode requires --answers <file>"
    );
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new SpecLintError(
      "interactive mode requires a TTY; pass --answers <file> instead"
    );
  }
  return promptAnswers();
}

async function promptAnswers(): Promise<SpecAnswers> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answers: SpecAnswers = {};
  try {
    process.stdout.write(
      "\nSpec answers — 모두 답해야 합니다. (Ctrl-C 로 취소)\n"
    );
    for (const q of QUESTIONS) {
      const a = (await rl.question(`Q (${q.id}) ${q.title}\n> `)).trim();
      answers[q.id] = a;
    }
  } finally {
    rl.close();
  }
  return answers;
}

export async function runSpec(
  input: SpecInput,
  deps: StageDeps
): Promise<SpecResult> {
  if (!(await deps.artifact.exists("context.md"))) {
    throw new SpecPrecondError("context.md (run `harness context`)");
  }
  const answers = await loadAnswers(input, deps.cwd);
  lintAnswers(answers);

  const sections = QUESTIONS.map(
    (q) => `## ${q.title}\n\n${(answers[q.id] ?? "").trim()}\n`
  );
  const md = `# SPEC\n\n${sections.join("\n")}`;
  await deps.artifact.writeMarkdown("SPEC.md", md);
  return { path: ".harness/SPEC.md", answeredCount: QUESTIONS.length };
}
