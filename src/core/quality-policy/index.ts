import type { StageDeps } from "../stage-runner.js";

export interface PolicyInput {
  inheritFrom?: string;
}

export interface PolicyResult {
  policyPath: string;
  rulesPath: string;
  hooksPath: string;
  contextPolicyPath: string;
}

export class PolicyPrecondError extends Error {
  readonly exitCode = 10;
  constructor(missing: string) {
    super(`policy stage requires ${missing}`);
    this.name = "PolicyPrecondError";
  }
}

const DEFAULT_RULES = {
  schemaVersion: "0.3",
  language: "typescript",
  frameworks: ["node"],
  applied: [
    {
      id: "ts-strict",
      title: "TypeScript strict 모드 사용",
      scope: ["src/**/*.ts"],
      owner: "implementation-agent",
      severity: "high",
      rationale: "타입 안정성"
    },
    {
      id: "function-size",
      title: "함수 길이 50줄 이하",
      scope: ["src/**/*.ts"],
      owner: "implementation-agent",
      severity: "warning"
    }
  ],
  deferred: []
};

const DEFAULT_HOOKS = {
  schemaVersion: "0.3",
  hooks: [
    {
      id: "pre-tool/ts-typecheck",
      type: "pre-tool",
      trigger: "before:work",
      command: "npx tsc --noEmit",
      blocking: true,
      describe: "타입 오류 있으면 work 진입 차단"
    },
    {
      id: "post-tool/test-run",
      type: "post-tool",
      trigger: "after:work",
      command: "npm test",
      blocking: false,
      describe: "테스트는 자동 실행하되 결과만 기록"
    }
  ]
};

const CONTEXT_POLICY = `# Context Policy

## 1. 적재 (Load)
- 현재 task 의 acceptance criteria, 관련 파일 경로만 적재.
- domain 용어집은 항상 적재.

## 2. 제거 (Drop)
- task 완료 직후 task 별 컨텍스트는 worklog 에 요약 후 제거.

## 3. 보호 (Protect)
- 절대 컨텍스트에 들이지 않을 것: .env, credential, key, token.

## 4. 사이즈 가드
- 80% 도달 시 경고. 90% 도달 시 다음 work 거부.
`;

function policySummary(): string {
  return [
    "# Quality Policy",
    "",
    "## 1. 언어/프레임워크",
    "- TypeScript 5.x, Node.js 20",
    "",
    "## 2. 적용 rules 묶음 요약",
    "- ts-strict, function-size",
    "",
    "## 3. 적용 hooks 묶음 요약",
    "- pre-tool/ts-typecheck (blocking)",
    "- post-tool/test-run",
    "",
    "## 4. 검색·테스트·보안·리뷰 정책",
    "- search-first, test-first, security-first, review-first (기본 ON)",
    "",
    "## 5. 위험 파일 변경 정책",
    "- .env, credentials, CI, deploy, auth 파일은 자동 Human Gate",
    "",
    "## 6. context 정책",
    "- context-policy.md 참고"
  ].join("\n");
}

export async function runPolicy(
  _input: PolicyInput,
  deps: StageDeps
): Promise<PolicyResult> {
  if (!(await deps.artifact.exists("harness-design.md"))) {
    throw new PolicyPrecondError("harness-design.md (run `harness design`)");
  }

  await deps.artifact.writeJson("rules.json", DEFAULT_RULES, "rules");
  await deps.artifact.writeJson("hooks.json", DEFAULT_HOOKS, "hooks");
  await deps.artifact.writeMarkdown("context-policy.md", CONTEXT_POLICY);
  await deps.artifact.writeMarkdown("quality-policy.md", policySummary());

  return {
    policyPath: ".harness/quality-policy.md",
    rulesPath: ".harness/rules.json",
    hooksPath: ".harness/hooks.json",
    contextPolicyPath: ".harness/context-policy.md"
  };
}
