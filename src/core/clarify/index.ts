import type { StageDeps } from "../stage-runner.js";

export interface ClarifyResult {
  path: string;
}

const TEMPLATE = `# Clarify

> 6축 질문에 답하세요. 답변이 비어 있으면 spec 단계에서 거부될 수 있습니다.

## 사용자 대상
- Q1. 누가 쓰는가?
- A:

## 해결하려는 문제
- Q2. 왜 필요한가? 없으면 어떤 문제가 생기는가?
- A:

## 성공 기준
- Q3. 어떻게 "끝났음" 을 알 수 있는가?
- A:

## 하지 않을 것
- Q4. 이번 버전에서 명시적으로 하지 않을 것은?
- A:

## 위험 요소
- Q5. 실패 시 무엇이 망가지는가? 위험도는?
- A:

## 배포/적용 범위
- Q6. 어떤 환경/사용자에게 영향이 가는가?
- A:
`;

export async function runClarify(deps: StageDeps): Promise<ClarifyResult> {
  await deps.artifact.writeMarkdown("clarify.md", TEMPLATE);
  return { path: ".harness/clarify.md" };
}
