/**
 * `.harness/` 초기 부트스트랩. 14 단계와 별개로 동작하는 부수 명령.
 */
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { harnessRoot } from "../utils/paths.js";

export interface InitInput {
  force?: boolean;
  cwd?: string;
}

export interface InitResult {
  harnessDir: string;
  created: string[];
}

export class HarnessAlreadyInitializedError extends Error {
  readonly exitCode = 11;
  constructor(path: string) {
    super(`.harness/ already exists at ${path} (use --force to overwrite)`);
    this.name = "HarnessAlreadyInitializedError";
  }
}

const CONFIG_JSON = JSON.stringify(
  { schemaVersion: "0.3", reviewAdapters: [], approvedExports: ["claude"] },
  null,
  2
);

const GITIGNORE = [
  "# auto-managed by harness init",
  "approval.txt",
  "config.json",
  "audit.jsonl",
  ""
].join("\n");

export async function runInit(input: InitInput = {}): Promise<InitResult> {
  const root = harnessRoot(input.cwd);
  let exists = false;
  try {
    await stat(root);
    exists = true;
  } catch {
    exists = false;
  }
  if (exists && !input.force) throw new HarnessAlreadyInitializedError(root);

  await mkdir(root, { recursive: true });
  const created: string[] = [];

  await writeFile(join(root, "config.json"), CONFIG_JSON + "\n", "utf8");
  created.push("config.json");

  await writeFile(join(root, "audit.jsonl"), "", "utf8");
  created.push("audit.jsonl");

  await writeFile(join(root, ".gitignore"), GITIGNORE, "utf8");
  created.push(".gitignore");

  return { harnessDir: root, created };
}
