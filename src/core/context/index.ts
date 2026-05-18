import type { StageDeps } from "../stage-runner.js";

export interface ContextResult {
  path: string;
}

const TEMPLATE = `# Context

> 도메인·기존 구조·제약을 6 섹션으로 정리합니다. "해당 없음" 도 허용.

## 1. 도메인 용어
-

## 2. 기존 코드 구조
-

## 3. 관련 파일
-

## 4. 외부 의존성
-

## 5. 보안 제약
-

## 6. 테스트 제약
-
`;

export class ContextPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`context stage requires ${missing}`);
    this.name = "ContextPrecondError";
  }
}

export async function runContext(deps: StageDeps): Promise<ContextResult> {
  if (!(await deps.artifact.exists("clarify.md"))) {
    throw new ContextPrecondError("clarify.md (run `harness ask`)");
  }
  await deps.artifact.writeMarkdown("context.md", TEMPLATE);
  return { path: ".harness/context.md" };
}
