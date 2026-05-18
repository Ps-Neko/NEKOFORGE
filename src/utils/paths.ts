/**
 * `.harness/` 경로 헬퍼. 다른 모듈은 본 헬퍼만 사용한다.
 */
import { resolve, join, isAbsolute } from "node:path";

export const HARNESS_DIR = ".harness";

export function workspaceRoot(cwd: string = process.cwd()): string {
  return resolve(cwd);
}

export function harnessRoot(cwd: string = process.cwd()): string {
  return join(workspaceRoot(cwd), HARNESS_DIR);
}

export function harnessPath(
  ...parts: readonly string[]
): string {
  return join(harnessRoot(), ...parts);
}

export function withinHarness(
  absolutePath: string,
  cwd: string = process.cwd()
): boolean {
  const root = harnessRoot(cwd);
  const abs = isAbsolute(absolutePath) ? absolutePath : resolve(cwd, absolutePath);
  return abs === root || abs.startsWith(root + "/") || abs.startsWith(root + "\\");
}
