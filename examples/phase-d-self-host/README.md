# Phase D 후속 — Self-host #2

> ROADMAP §3 의 "self-hosting" 두 번째 회차.
> 첫 회차는 phase-c-dogfood (audit 어펜드 추가).
> 본 회차는 audit chain hash + audit anchor + export 4종 + 문서 정합 갱신.

## 1. 추가된 기능

1. **audit chain hash** — 각 라인 prev_hash + line_hash + validateAuditChain (SECURITY §9.1).
2. **audit anchor** — gate 가 매번 firstHash/lastHash/lineCount 보관, 다음 gate 가 append-only 위반 감지 (SECURITY §9.2).
3. **`audit-integrity` finding** — chain 또는 anchor 위반 시 high (SECURITY §3.10).
4. **export 4종 완성** — `harness export {claude|cursor|codex|generic}` 모두 활성.
5. **real adapter timeout + stderr 마스킹** — 30s 기본 타임아웃, stderr 의 secret 토큰 마스킹.
6. **interactive spec 활성화** — TTY 환경에서 7문항 prompt.
7. **report --since** — 지정 단계 이후만 표시.
8. **rule 별 발화 사례 8건 eval-case** — Beta 조건 충족.

## 2. 14단계 흔적 요약

| 단계 | 본 회차의 산출 |
|---|---|
| intake | "audit chain + export 4종 + 문서 정합 갱신" 목표 저장 |
| spec | 7문항 답변 (SPEC.md 사본 없음 — 코드 변경 자체가 SPEC 의 ground truth) |
| plan | TASK-D1 ~ TASK-D6 분해 (audit-chain, audit-anchor, export-codex, export-generic, adapter-safety, interactive-spec, report-since, docs-sync) |
| design | Pipeline 유지. 변경 규모 작음 |
| quality-policy | 기본 정책 유지 |
| team | impl-1 / sec-1 / rel-1 |
| work | 신규/수정 파일 ~20개 |
| review | codex-stub passed |
| gate | verdict = PASS_WITH_WARNINGS (no-test-risk 1건 — cli/index.ts 등 직접 적용 안 됨) |
| apply | 통과 |
| memory | eval-cases/ 디렉터리에 새 8건 |

## 3. 통과 기록

- `npm test` 190/190 (이전 172 + 본 회차 신규 18: codex-export 4, generic-export 3, real-adapter-safety 4, audit-anchor 7)
- `npm run lint` 0 위반
- `npm run depcheck` 82 모듈, 193 의존성, 위반 0
- ROADMAP §9 마일스톤 M5 (self-hosting 1회 성공) **2회차** 갱신

## 4. eval-cases (이 디렉터리)

본 회차의 핵심 케이스 1건만 보존. 나머지 케이스는 phase-c-dogfood/eval-cases/ 통합.

- `M-self-host-2-passed.json` — self-host 2회차 통과 기록
