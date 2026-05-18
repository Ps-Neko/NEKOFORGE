# TASKS

| id | title | depends | acceptance | tests | rollback | expectedFiles | doneCriteria |
|---|---|---|---|---|---|---|---|
| TASK-C1 | audit 모듈 추가 | - | append 함수 비동기+동기, init 안된 경우 graceful | `tests/unit/utils/audit.test.ts` 4 케이스 | 파일 삭제 | `src/utils/audit.ts` | 4 단위 테스트 통과 |
| TASK-C2 | cli/index.ts 진입/종료 hook | TASK-C1 | command_start + on("exit")→command_end | full-flow.test 가 audit.jsonl 생성 확인 | 변경 되돌림 | `src/cli/index.ts` | full-flow 통과 |
| TASK-C3 | gate verdict 이벤트 | TASK-C1 | gate 종료 시 `gate_verdict` 한 줄 | T-SEC-05 등 통과 + 수동 확인 | 변경 되돌림 | `src/core/gate/index.ts` | T-SEC 전부 통과 |
| TASK-C4 | apply 시도 이벤트 | TASK-C1 | apply 종료 시 `apply_attempt` 한 줄 | T-SEC-07 통과 (refuse 시 추적) | 변경 되돌림 | `src/core/apply/index.ts` | T-SEC 전부 통과 |
