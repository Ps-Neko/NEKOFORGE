# FUTURE — Worker Runtime (Phase WF-3 후보, 미예약)

> **상태**: 검토 자료. 미구현. 본 문서는 진행 약속이 아니라 **검토 후보 보존**.

## 1. 본 문서가 답하는 것

Phase WF (v0.5) 는 worker prompt 생성 + result import 까지만 다룬다. 다음 Phase 후보:

```text
Phase WF-3 = worker prompt 자동 LLM 실행 + 결과 자동 수집
```

본 문서는 **언제 / 어떻게 / 왜** 이 단계를 도입할지를 미리 정리. 도입 시점에는 정체성 침해 여부를 다시 검토.

## 2. 가능한 adapter 후보

```text
dispatch --adapter claude     # Claude API / claude CLI
dispatch --adapter codex      # Codex CLI / API
dispatch --adapter gemini     # Gemini API
dispatch --adapter shell      # shell 명령 (사용자 정의)
dispatch --adapter omc        # OMC orchestration
```

각 adapter 는 다음 인터페이스 구현:

```typescript
interface WorkerAdapter {
  readonly id: string;
  available(): Promise<boolean>;
  dispatch(input: {
    role: WorkerRole;
    prompt: string;
    taskId: string;
  }): Promise<{
    status: "completed" | "failed" | "needs_input";
    resultMd: string;
    resultJson?: WorkerResultJson;
  }>;
}
```

## 3. 비-목표 (Phase WF-3 에서도 금지)

```text
- worker 가 직접 git commit/push/deploy 실행 금지
- worker 가 직접 harness apply 실행 금지
- worker 가 decision.json 작성 금지
- background autonomous loop 금지 (사용자 명시 호출만)
- tmux/screen 같은 long-running runtime 금지
- 외부 SaaS 의존 도입 금지
```

## 4. 진입 조건

다음 신호 중 **2개 이상** 누적 시 검토 진입:

1. 외부 사용자 PR ≥ 1건이 dispatch + worker-result import 흐름을 실제로 활용.
2. 자동 LLM 실행 요청이 issue / discussion 에 3건 이상.
3. Claude Code / Codex CLI 등 사용자 환경에서 worker dispatch 가 반복적 manual 부담을 만든다는 측정.

## 5. 검토 시 고려할 trade-off

| 항목 | 위험 |
|---|---|
| LLM spawn 비용 | 사용자가 의도치 않은 비용 발생 — `--max-cost <USD>` 같은 가드 필요 |
| 결정성 | LLM 결과는 비결정 — fixture/benchmark 가 깨질 위험 |
| Audit chain | LLM 호출이 audit.jsonl 에 기록되는 형식 결정 |
| Worker safety | 자동 실행된 worker 의 forbidden action 검증이 더 중요 — detectForbiddenActions FP 회피 패턴 정밀화 필요 |
| API key | secret 관리 — .env / 외부 SaaS 의존 금지 정책과의 정합 |

## 6. 본 문서가 답하지 않는 것

- 현재 Phase WF (v0.5) 의 명세 → docs/WORKER-FACTORY.md
- worker safety 강제 → docs/WORKER-SAFETY.md
- worker role ↔ team agent 매핑 → docs/HARNESS-DESIGN.md §2.A
- 본 문서의 진행 결정 → ROADMAP.md (현재 §8 영구 비-목표 와 충돌하지 않을 때만)
