# PLAN

- 작업 순서: TASK-C1 → TASK-C2 → TASK-C3 → TASK-C4
- risk list:
  - process.on("exit") 핸들러가 비동기 작업을 못 한다 → 동기 fs API 사용.
  - audit 가 init 전 호출되면 .harness 자동 생성 → 의도 어긋남.
- rollback plan: 신규 모듈/import 만 제거하면 회귀 없음.
