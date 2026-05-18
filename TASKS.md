# TASKS — Verified AI Development Harness v3 (Phase B 구현 분해)

> 버전 0.3 · 2026-05-18 · 본 문서는 ROADMAP.md §3 Phase B 의 작업을 task 단위로 분해한 작업 목록이다. 각 task 는 ARCHITECTURE.md §4 모듈, SECURITY.md §3 의 9 룰, CLI.md §3 의 14 명령과 추적 가능해야 한다.

## 0. 규칙

- task 1개 = `harness work <task-id>` 1회 호출 분량.
- 각 task 6필드 필수 : `id`, `title`, `depends`, `acceptance`, `tests`, `rollback`.
- 의존성은 task-id 명시. 미명시 시 "없음(-)".
- 본 문서가 Phase B 진입 시 `.harness/TASKS.md` 의 원본 시드로 사용.

## 1. 부트스트랩 (B0-*)

| id | title | depends | acceptance | tests | rollback |
|---|---|---|---|---|---|
| B0-001 | repo 부트스트랩 | - | `package.json`, `tsconfig.json`, `eslint.config.js`, `.editorconfig` 존재. `npm install` 성공. | `npm run lint` 0건. | 전체 파일 삭제. |
| B0-002 | 디렉터리 스켈레톤 | B0-001 | ARCHITECTURE §3 의 `src/cli`, `src/core/<14단계>`, `src/rules`, `src/hooks`, `src/integrations/{codex,claude,cursor,generic}`, `src/schemas`, `src/artifact`, `src/utils`, `tests/{unit,integration,e2e}`, `examples/` 와 `index.ts` placeholder. | `npm run build` 빈 빌드 성공. | 디렉터리 삭제. |
| B0-003 | 의존성 정책 도구 | B0-002 | `dependency-cruiser` + `depcruise.config.cjs` 가 ARCHITECTURE §7 규칙 표현. | `npm run depcheck` 위반 0건. | 설정 제거. |
| B0-004 | 테스트 러너 설정 | B0-002 | `node:test` + `tsx`, `npm test` 빈 셋 0 exit. | 빈 테스트 1개 통과. | 스크립트 제거. |

## 2. 인프라 (B1-*)

| id | title | depends | acceptance | tests | rollback |
|---|---|---|---|---|---|
| B1-010 | `src/artifact/` 구현 | B0-002 | `ArtifactReader/Writer` 인터페이스 + `.md`/`.json` 동시 쓰기. | unit : 왕복, 비존재 경로 null. | 모듈 삭제. |
| B1-011 | `src/schemas/` 정의 | B0-002 | 7 schema (decision, team, agent-routing, rules, hooks, codex-findings, eval-case) + Ajv 로더. | unit : 유효/무효 각 2 케이스. | 스키마 삭제. |
| B1-012 | `src/utils/` 핵심 | B0-002 | `diff.ts`, `paths.ts`, `logger.ts`, `time.ts`, `mask.ts`(secret 마스킹). | unit : diff 비-git 환경 graceful, mask 정확성. | 모듈 삭제. |
| B1-013 | `src/cli/index.ts` 골격 | B0-002, B1-012 | 14개 명령 stub + `--help`, `--version`. | integration : 14 명령 `--help` exit 0. | 파일 삭제. |
| B1-014 | `src/cli/ui/` 포매터 | B1-013 | 색·표·요약, `--no-color`/`--quiet`. | unit : 스냅샷. | 모듈 삭제. |
| B1-015 | 감사 로그 `audit.jsonl` | B1-010 | 모든 CLI 명령 진입/종료 시 JSON Lines 1행. | integration : N회 → 2N라인. | 어펜더 비활성. |
| B1-016 | hooks 인프라 | B1-011 | `src/hooks/` 에 `HookRunner` 구현. 6 type 디스패치. blocking/non-blocking 처리. command 화이트리스트. | unit : type 별 ≥3 케이스. | 모듈 삭제. |

## 3. core 단계 모듈 (B2-*)

| id | title | depends | acceptance | tests | rollback |
|---|---|---|---|---|---|
| B2-020 | intake | B1-010, B1-013 | `harness ask` → `.harness/intake.md` (원문 무가공). | integration : 원문 포함. | stub 으로 회귀. |
| B2-021 | clarify | B2-020 | 6축 질문 → `.harness/clarify.md`. | unit : 6축 각 ≥1 질문. | 비활성. |
| B2-022 | context | B2-021 | 6섹션 lint → `.harness/context.md`. (v3 신규 독립 명령) | unit : 누락 섹션 거부. | 비활성. |
| B2-023 | spec | B2-022, B1-014 | Gstack 7문항 강제(+실패 기준), `--non-interactive`. | unit : TBD 거부. integration : `--answers`. | 모듈 제거. |
| B2-024 | plan | B2-023, B1-011 | PLAN.md + TASKS.md 8컬럼 lint. | unit : 누락 컬럼 거부. | 비활성. |
| B2-025 | harness-design | B2-024, B1-011 | 패턴 6종 선택. team.json + orchestrator.md + skills-map.json. self-check(HARNESS-DESIGN §11). | unit : 패턴 별 lint. integration : `--pattern` 유효성. | 비활성. |
| B2-026 | quality-policy | B2-025, B1-011, B1-016 | rules.json + hooks.json + context-policy.md + quality-policy.md. self-check(QUALITY-POLICY §11). | unit : 화이트리스트 외 hook 거부. | 비활성. |
| B2-027 | team (runtime) | B2-025, B2-026, B1-011 | team-runtime.md + agent-routing.json. release-gatekeeper 필수. 권한 겸직 금지 lint. | unit : 겸직 lint. | 비활성. |
| B2-028 | work | B2-027, B1-012, B1-016 | task 1건 진행, diff 해시, pre/post hook 트리거, 중복 11 거부. | integration : 동일 id 2회 거부. | 비활성. |
| B2-029 | self-review | B2-028 | 7섹션 lint. | unit : "문제 없음" 거부. | 비활성. |
| B2-030 | codex-review | B2-029, B3-040 | adapter 호출, `codex-findings.json` 정규화, 0개 시 `not_run` 명시. | integration : stub 호출. | 비활성. |
| B2-031 | gate | B2-030, B4-050..058 | verdict 알고리즘(WORKFLOW §3.12) 구현. REPORT.md + decision.json. | unit : verdict 매핑 케이스 ≥12. | 비활성. |
| B2-032 | apply | B2-031 | ARCHITECTURE §10 알고리즘. `--approved` 필수. `--dry-run`. pre-apply/post-review hook. | integration : T-SEC-07/08/09. | 비활성. |
| B2-033 | memory | B2-032 | memory.md + eval-cases. apply 결과 자동 반영. | unit : 케이스 왕복. | 비활성. |
| B2-034 | report | B2-031 | read-only. JSON 출력 schema 검증. | unit : `--json` 스키마. | 비활성. |
| B2-035 | export 인프라 | B1-013, B2-027 | `harness export <tool>` 서브커맨드 + `ExportAdapter` 인터페이스. | unit : 알 수 없는 tool exit 1. | 명령 제거. |

## 4. integrations (B3-*)

| id | title | depends | acceptance | tests | rollback |
|---|---|---|---|---|---|
| B3-040 | ReviewAdapter + codex stub | B1-011 | `integrations/codex/stub.ts` 결정적 더미 반환. `available()` 토글. | unit : 토글, 결정성. | 스텁 제거. |
| B3-041 | review 결과 정규화 | B3-040 | 어댑터 출력 → `codex-findings.schema.json` 통과. | unit : 잘못된 출력 거부. | 비활성. |
| B3-042 | ExportAdapter claude | B2-035, B2-025, B2-026 | `.harness/team.json` 등 → `.claude/agents/*.md`, `.claude/skills/*.md`, `CLAUDE.md` 포인터. 결정적. 단방향. | unit : 결정성(동일 입력 → 동일 출력 해시). integration : 화이트리스트 외 경로 접근 시도 70. | 모듈 제거. |

## 5. deterministic rules (B4-*)

각 rule = `src/rules/<id>.ts` 한 파일. SECURITY §3 과 1:1.

| id | title | depends | acceptance | tests | rollback |
|---|---|---|---|---|---|
| B4-050 | secret-fallback | B1-012 | critical finding. | positive 3, negative 3 + 빈 fallback negative. | 비활성. |
| B4-051 | auth-bypass | B1-012 | critical. | positive 3, negative 3. | 비활성. |
| B4-052 | test-deletion | B1-012 | 삭제 critical, skip high. | positive 3, negative 3. | 비활성. |
| B4-053 | no-test-risk | B1-012 | warning. test-first 정책 ON 시 격상. | positive 3, negative 3. | 비활성. |
| B4-054 | dangerous-file-write | B1-012 | high. | positive 3, negative 3. | 비활성. |
| B4-055 | hook-injection-risk | B1-012, B1-016 | high. hooks.json 화이트리스트 외 변경 탐지. | positive 3, negative 3. | 비활성. |
| B4-056 | agent-permission-risk | B1-012, B2-027 | high. team.json/agent-routing.json 권한 확장 탐지. | positive 3, negative 3. | 비활성. |
| B4-057 | auto-apply-block | B2-032 | apply 진입 직전 verdict 재평가 exit 4. | integration : T-SEC-07/08. | 비활성. |
| B4-058 | codex-missing-risk | B2-030, B2-031 | 고위험 + codex `not_run` → high. 어댑터 0 + 고위험 → INSUFFICIENT_EVIDENCE. | unit + e2e : 두 분기 각 1 케이스. | 비활성. |

## 6. 회귀/보안 테스트 (T-SEC-*)

SECURITY §7 의 16 케이스. Phase B 종료 조건.

| id | title | depends | acceptance | tests | rollback |
|---|---|---|---|---|---|
| T-SEC-01 | secret-fallback → BLOCK | B4-050, B2-031, B2-032 | verdict BLOCK, apply 거부 exit 4. | e2e. | 케이스 삭제. |
| T-SEC-02 | auth-bypass → BLOCK | B4-051, B2-031, B2-032 | 동일. | e2e. | - |
| T-SEC-03 | test 삭제 → BLOCK | B4-052, B2-031, B2-032 | 동일. | e2e. | - |
| T-SEC-04 | skip 추가 → NEEDS_HUMAN_REVIEW | B4-052, B2-031 | verdict. | e2e. | - |
| T-SEC-05 | src only → PASS_WITH_WARNINGS | B4-053, B2-031 | verdict. | e2e. | - |
| T-SEC-06 | `.env` 변경 → NEEDS_HUMAN_REVIEW | B4-054, B2-031, B2-032 | 토큰 없으면 apply 3. | e2e. | - |
| T-SEC-07 | BLOCK 에서 apply | B2-032 | exit 4. | e2e. | - |
| T-SEC-08 | INSUFFICIENT_EVIDENCE 에서 apply | B2-032 | exit 4(또는 2). | e2e. | - |
| T-SEC-09 | decision.json 위변조 | B2-031, B2-032 | 모순 감지 → 강등 → 거부. | e2e. | - |
| T-SEC-10 | approval 토큰 mismatch | B2-032 | 부분 승인 불가 exit 3. | e2e. | - |
| T-SEC-11 | hooks.json 비-화이트리스트 | B4-055, B2-031 | hook-injection-risk → NEEDS_HUMAN_REVIEW. | e2e. | - |
| T-SEC-12 | 권한 겸직 | B4-056, B2-027, B2-031 | agent-permission-risk → NEEDS_HUMAN_REVIEW. | e2e. | - |
| T-SEC-13 | 고위험 + codex not_run | B4-058, B2-031 | codex-missing-risk → NEEDS_HUMAN_REVIEW. | e2e. | - |
| T-SEC-14 | 어댑터 0 + 고위험 | B4-058, B2-031 | INSUFFICIENT_EVIDENCE. | e2e. | - |
| T-SEC-15 | export 외부 경로 접근 | B3-042 | 거부 exit 70. | e2e. | - |
| T-SEC-16 | export 역류 금지 | B3-042 | `.claude/` → `.harness/` 경로 부재 확인. | e2e (negative). | - |

## 7. 문서·예제 동기화 (D-*)

| id | title | depends | acceptance | tests | rollback |
|---|---|---|---|---|---|
| D-001 | examples/01-basic-flow | B2-031 이상 | SPEC ~ apply 까지 산출물 샘플. | smoke : 시드로 gate 재현. | 디렉터리 삭제. |
| D-002 | examples/02-blocked-by-secret | B4-050, B2-031 | BLOCK 재현. | smoke. | - |
| D-003 | examples/03-needs-human-review | B4-054, B2-032 | `.env` 변경 + approval.txt 샘플 유/무 비교. | smoke. | - |
| D-004 | examples/04-codex-missing | B4-058, B2-031 | 고위험 + 어댑터 부재 시나리오. | smoke. | - |
| D-005 | examples/05-export-claude | B3-042 | `harness export claude` 결과물 샘플. | smoke + 결정성. | - |
| D-010 | README 30초 path 실측 갱신 | B2-031, D-001 | README §3 명령이 실제 출력과 ±5 토큰 이내. | manual + 자동. | 이전 README 복원. |

## 8. 진척 추적

- 본 파일은 Phase B 시작 시점에 `.harness/TASKS.md` 로 복사되어 `harness work <id>` 의 단일 진실원이 된다.
- 각 task 종료 시 `.harness/worklog.md` 에 동일 id 한 줄 적힘.
- "완료" 는 acceptance + tests 가 동시에 만족될 때만 인정.

## 9. 우선순위 / 의존 그래프

```text
B0-001 → B0-002 → B0-003
                ↘ B0-004

B0-002 → B1-010 → B1-011 ──▶ B1-013
              ↘ B1-012 ──▶ B1-013 ──▶ B1-014 ──▶ B1-015
              ↘                                  B1-016

B2-020 → B2-021 → B2-022 → B2-023 → B2-024
                                         ↓
                                    B2-025 (harness-design)
                                         ↓
                                    B2-026 (quality-policy)
                                         ↓
                                    B2-027 (team)
                                         ↓
                                    B2-028 → B2-029 → B2-030 → B2-031 → B2-032 → B2-033
                                                ↑                   ↑          ↑
                                              B3-040           B4-050..058   B2-035
                                                                              ↓
                                                                          B3-042

B4-* + B2-031..032  ──▶  T-SEC-01..16  ──▶  D-*  ──▶  M4 (ROADMAP §9)
```

## 10. 본 문서가 답하지 않는 것

- 제품 정체성 → PRODUCT.md
- 모듈 구조·인터페이스 → ARCHITECTURE.md
- 단계 흐름 → WORKFLOW.md
- 팀 패턴 매뉴얼 → HARNESS-DESIGN.md
- 품질 정책 매뉴얼 → QUALITY-POLICY.md
- 위협·룰 상세 → SECURITY.md
- 명령 인자·exit code → CLI.md
- Phase B 종료 조건 → ROADMAP.md §3
