# Example 01 — Basic flow (happy path)

> TASKS.md D-001 — minimal 14단계 happy path 시연.

## 시나리오

가상의 작업 : "사용자 로그인 5회 실패 시 30분 잠금 기능 추가".

다음 흐름이 한 번에 통과한다 (verdict = PASS_WITH_WARNINGS).

```text
harness init
harness ask "사용자 로그인 5회 실패 시 30분 잠금 기능 추가"
harness context
harness spec --non-interactive --answers ./answers.json
harness plan
harness design --pattern Producer-Reviewer
harness policy
harness team
harness work TASK-001
harness review --adapter codex-stub
harness gate --task TASK-001 --test-status passed
harness apply --approved
harness report
harness export claude
```

`tests/integration/full-flow.test.ts` 가 동일 흐름을 자동 검증한다.

## 입력 샘플

- `answers.json` — 7문항 답변 (가상)

## 변형

- `phase-c-dogfood/` — 본 도구로 audit 자동 어펜드 기능 추가의 14단계 흔적
- `phase-d-self-host/` — 본 도구로 audit chain hash + export 4종 + 문서 정합 갱신의 14단계 흔적

## 메모

본 디렉터리는 "코드 변경 없이도 happy path 가 어떻게 보이는지" 를 보여주는 용도. 실제 사고 시나리오(verdict ≠ PASS)는 examples/02~04 참고.
