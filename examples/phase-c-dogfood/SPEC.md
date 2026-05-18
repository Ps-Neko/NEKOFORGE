# SPEC

## 누가 쓰는가?

본 도구 사용자 본인. 자신의 명령 흔적을 사후 검증해야 할 때.

## 왜 필요한가?

SECURITY.md §9 의 audit trail 요구가 본 도구의 정체성과 직결된다.
"명령 흔적이 남는가" 는 사용자 신뢰의 기반.

## 없으면 어떤 문제가 생기는가?

apply 시도 흔적이 사라지면 사고 후 추적이 불가능해진다.
verdict 결정 흔적이 사라지면 gate 의 결정이 외부에서 재현·검증되지 않는다.

## 핵심 기능은 무엇인가?

- 모든 CLI 명령 진입 시 `command_start` 한 줄 append.
- 종료 시 (정상·오류 모두) `command_end` 한 줄 append.
- `gate` 가 verdict 산출 후 `gate_verdict` 한 줄 append.
- `apply` 가 시도 시 `apply_attempt` 한 줄 append.
- `.harness/` 미초기화 환경에서는 조용히 무시.

## 이번 버전에서 하지 않을 것은 무엇인가?

- audit.jsonl 의 chain hash · 위변조 자동 감지 (Phase C 후속 또는 D).
- 외부 SIEM 송신.
- 토큰 마스킹 (이미 mask 모듈로 보장하나, audit 자체에 별도 마스킹 안 함).

## 성공 기준은 무엇인가?

- `npm test` 통과.
- `.harness/audit.jsonl` 가 명령 1회 실행 후 ≥2 줄 (start + end).
- 기존 T-SEC 16 케이스 모두 그대로 통과.

## 실패 기준은 무엇인가?

- audit append 실패가 CLI 명령 자체를 죽이면 실패.
- audit 가 init 전에도 .harness/ 를 자동 생성하면 실패.
- 기존 T-SEC 케이스 중 한 개라도 회귀.
