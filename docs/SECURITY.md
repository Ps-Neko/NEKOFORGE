# SECURITY — Verified AI Development Harness (v3)

> 버전 0.3 · 2026-05-18 (Phase A) · 2026-05-19 (Codex feedback round 후속) · 본 문서는 PRODUCT.md §3 원칙 1·3(독립 검증 / 위험 작업 차단)을 실제 차단 메커니즘으로 구현하는 명세다. WORKFLOW.md §3.12 gate 와 §3.13 apply 가 본 명세를 참조한다.

## 0. 책임 경계 — 본 도구가 책임지는 것과 책임지지 않는 것

NEKOFORGE 는 14단계 산출물의 **골격(구조)** 과 단계 간 **강제력(차단)** 만 책임진다.

- **본 도구 책임**: 산출물 파일 형식, schema 검증, deterministic rule 발화, verdict 산출, Human Gate 강제, audit chain 무결성.
- **사용자/agent 책임**: 산출물의 **내용** (context 의 6 섹션 본문, plan 의 task 행 내용, self-review 의 7 섹션 본문, harness-design 의 패턴 선택 이유 등).

본 도구가 작성하는 placeholder(예: `(작성)`, `-`, `(확인 항목)`) 는 그대로 두면 14단계 통과 자체에 영향을 주지 않는다. 다음 단계의 lint 는 **형식 준수** 만 검증하지 본문이 의미 있는지 검증하지 않는다. 사용자/agent 가 채우지 않은 산출물로 verdict 가 PASS 가 되어도 그것은 사용자 책임이며, 본 도구는 적합한 placeholder 가 거기 있음을 보장할 뿐이다.

이 경계는 의도된 한계다. LLM 없이도 결정적으로 동작하는 본 도구의 정체성과 정합한다. 단, **사용자/agent 가 산출물을 실질적으로 채워야 본 공정의 가치가 발생** 한다는 점은 README §10 과 SECURITY 9 (audit) 가 함께 권고한다.

## 1. 위협 모델 (Threat Model)

### 1.1 1차 위협 — "AI 가 만든 변경의 무검증 적용"

- AI 어시스턴트가 fallback secret/key 를 코드에 박아 둠.
- AI 가 테스트를 "수정" 한다는 명목으로 실제로는 skip 처리.
- AI 가 인증 미들웨어를 "단순화" 한다는 명목으로 우회 경로 생성.
- AI 가 `.env`, CI 설정, 배포 스크립트를 사용자가 의도하지 않은 형태로 수정.

### 1.2 2차 위협 — "리뷰 어댑터의 결과 오용"

- 외부 ReviewAdapter(Codex 등)의 PASS 가 자동 승인으로 오인됨.
- 어댑터 출력이 변조되었거나 부분 적재되었는데 PASS 로 집계됨.
- 단일 어댑터가 의사결정을 독점.

### 1.3 3차 위협 — "공정의 점진적 마모"

- "이번만 우회" 옵션이 누적되어 차단 메커니즘이 형식화.
- 환경변수/숨김 플래그로 verdict 우회.
- decision.json 을 수동 편집하여 BLOCK → PASS 변경.

### 1.4 v3 신규 위협 — "hook · agent permission · 도구 export 의 측면 공격"

- AI 가 `.harness/hooks.json` 에 악성 명령을 hook 으로 등록.
- AI 가 agent 의 권한 범위를 슬쩍 넓히는 변경.
- export adapter 가 `.harness/` 의 무관한 정보를 `.claude/` 에 노출.
- export 가 역방향으로 `.claude/` 의 임의 입력을 `.harness/` 로 들여오는 경로 추가 시도.

### 1.5 비위협 (다루지 않음)

- 사용자의 의도적 악의 — 본 도구는 사용자를 적으로 가정하지 않음.
- LLM 자체의 모델 보안.
- OS 권한 우회.

## 2. 차단 메커니즘 개관

```text
[diff/파일/메타]                       [어댑터 결과]
       │                                      │
       ▼                                      ▼
  deterministic rules (9종)            review adapters
       │                                      │
       └────────────┬─────────────────────────┘
                    ▼
              gate verdict 산출
                    │
                    ▼
              decision.json (schema 강제)
                    │
                    ▼
              apply 차단 알고리즘 (ARCHITECTURE.md §10)
                    │
                    ▼
              apply-log.md
```

## 3. Deterministic Rules — 9종 명세

각 rule 은 `src/rules/<rule-id>.ts`. 모두 순수 함수.

### 3.1 secret-fallback

- 환경변수/secret 부재 시 코드에 박힌 fallback 값으로 동작하는 패턴 차단.
- 휴리스틱 : `process.env.X || "..."` 우변 길이 ≥8 문자열, `os.environ.get("X", "literal")`, 변수명 `[A-Z_]+(KEY|SECRET|TOKEN|PASS|PWD|API)` + 우변 리터럴.
- 등급 : `critical` → BLOCK.

### 3.2 auth-bypass

- 인증/인가 미들웨어 제거·우회·조건 완화.
- 휴리스틱 : `requireAuth(`, `isAuthenticated(`, `verifyJwt(`, `@PreAuthorize` 의 삭제. `if (true)`, `if (process.env.NODE_ENV !== "production")` 형태 분기. `next()` 가 인증 검사 없이 호출.
- 등급 : `critical` → BLOCK.

### 3.3 test-deletion

- 테스트 파일 삭제 또는 skip 증가.
- 휴리스틱 : `tests/`, `**/*.test.*`, `**/*_test.*` 삭제 또는 큰 폭 축소. `.skip(`, `xdescribe(`, `xit(`, `pytest.mark.skip`, `@Disabled` 신규 추가.
- 등급 : 삭제는 `critical` → BLOCK. skip 추가는 `high` → NEEDS_HUMAN_REVIEW.

### 3.4 no-test-risk

- 기능 변경 vs 테스트 무변경.
- 휴리스틱 : `src/` 변경 + `tests/`(또는 `*.test.*`) 변경 0. 예외 허용 : `docs/`, 주석만, `package-lock.json` 만, 단순 import 정렬.
- 등급 : `warning` → verdict ≤ PASS_WITH_WARNINGS. test-first 정책 ON 시 → NEEDS_HUMAN_REVIEW.

### 3.5 dangerous-file-write

- 민감 파일 변경.
- 휴리스틱 : `.env`, `.env.*`, `**/credentials*`, `**/secret*`, `**/*.pem`, `**/*.key`, `**/*.crt`, `**/*.p12`, `**/*.pfx`, `.github/workflows/**`, `.gitlab-ci.yml`, `circle.yml`, `azure-pipelines.yml`, `Dockerfile`, `docker-compose*.yml`, `kubernetes/**`, `helm/**`, `terraform/**`, `pulumi/**`. 경로에 `auth|iam|oauth|jwt|session` 포함.
- 등급 : `high` → NEEDS_HUMAN_REVIEW.

### 3.6 hook-injection-risk (v3 신규)

- hook · script · lifecycle command · postinstall · precommit · CI script 변경.
- 휴리스틱 :
  - `.harness/hooks.json` 의 `command` 필드가 화이트리스트 외 값으로 변경.
  - `package.json` 의 `scripts.postinstall`, `scripts.prepare`, `scripts.precommit` 추가/수정.
  - `.husky/*`, `.lefthook.yml`, `.pre-commit-config.yaml` 변경.
  - npm install 시 자동 실행될 수 있는 `bin` 필드 변경.
- 등급 : `high` → NEEDS_HUMAN_REVIEW.

#### Windows .cmd 우회 (self-host #6, 2026-05-19)

Node.js 20+ 가 CVE-2024-27980 fix 로 `.cmd`/`.bat` 의 `shell:false` 실행을 차단함. 본 도구는 다음으로 우회한다:

1. 입력 화이트리스트 (`isAllowedCommand`) 가 셸 메타 문자를 입력 단계에서 차단. SHELL_META_RE 미통과는 무조건 reject.
2. `resolveExecutable(cmd, platform)` 가 Windows + 화이트리스트 명령에 한해 `.cmd` 부착.
3. SPAWN_INJECTOR 가 `.cmd`/`.bat` 일 때만 `cmd.exe /c <cmd> <args...>` 로 우회 (shell:false 유지).
4. 인자는 split(/\s+/) 분리 후 cmd.exe argv 로 직접 전달 → DEP0190 의 결합 위험 회피.

이 우회는 hook-injection-risk 의 침해가 아니다. 입력 화이트리스트가 같으며, shell 메타가 평가되는 경로가 없다. 외부 검증자가 의문 시 `src/hooks/runner.ts` 의 SPAWN_INJECTOR 와 4 단위 테스트 (resolveExecutable * platform) 를 확인.

### 3.7 agent-permission-risk (v3 신규)

- agent 또는 tool 권한이 넓어지는 변경.
- 휴리스틱 :
  - `.harness/team.json` 또는 `.harness/agent-routing.json` 의 `owns` 확장(특히 보안 관련 task 확장).
  - 한 agent ID 가 `implementation-agent` 와 `security-reviewer` 또는 `release-gatekeeper` 를 겸직.
  - hooks.json 에 새 agent 가 `blocking: true` 권한으로 등록.
  - `.claude/agents/*.md` 의 권한 범위(tools 화이트리스트) 확장 — export 결과물에 한해 경고.
- 등급 : `high` → NEEDS_HUMAN_REVIEW.

### 3.8 auto-apply-block

- BLOCK 또는 INSUFFICIENT_EVIDENCE 상태에서 apply/commit/push/deploy 시도.
- 위치 : `core/apply/`, `cli/commands/apply.ts` 양쪽 중복 구현(다층 방어).
- 발화 시 finding 을 만들지 않고 즉시 exit code 4 throw.

### 3.9 codex-missing-risk (v3 신규)

- 고위험 변경인데 외부 ReviewAdapter 결과가 `not_run`.
- 휴리스틱 : 다음 중 하나라도 참이면 "고위험" 으로 분류.
  - dangerous-file-write 발화.
  - auth-bypass 또는 secret-fallback 발화.
  - hook-injection-risk 또는 agent-permission-risk 발화.
  - Producer-Reviewer 패턴 채택 + critical task.
- 그 상태에서 `codex-findings.json.status === "not_run"` 이면 본 rule 트리거.
- 등급 : `high` → NEEDS_HUMAN_REVIEW. 어댑터가 1개도 등록 안 되어 있고 어댑터 fallback 도 없으면 → INSUFFICIENT_EVIDENCE.

### 3.10 audit-integrity (Phase C 후속 신규)

- `.harness/audit.jsonl` 의 chain hash 검증 + audit-anchor.json 의 append-only 위반 감지.
- 두 가지 위반:
  - **chain 무결성**: 각 라인의 `prev_hash` 가 직전 라인의 `line_hash` 와 불일치하거나, `line_hash` 재계산이 다른 경우.
  - **anchor append-only 위반**: 이전 gate 의 anchor 와 비교해 `firstHash` 가 바뀌었거나 `lineCount` 가 감소한 경우.
- 등급 : `high` → NEEDS_HUMAN_REVIEW.
- 본 finding 은 `src/rules/` 하의 deterministic rule 카탈로그가 아니라 gate 모듈이 직접 생성한다 (audit 입력이 diff 가 아닌 audit.jsonl 자체이기 때문).

### 3.11 architecture rules (Phase QF 신규, 4종)

본 4종은 `src/rules/architecture/` 에 위치. gate 가 별도로 실행해 `decision.json.architectureReview` 와 `qualityScore.scores.{maintainability,architecture}` 에 반영.

- `large-file-risk` : 단일 파일 +600 라인 이상 `high`, +300 이상 `warning`.
- `layer-violation` : core/<A>→core/<B> 직접 import, integrations→core, `.claude/`→`.harness/` 역방향 import.
- `untyped-api-risk` : `: any` / `as any` / export function 반환 타입 누락.
- `circular-dependency-risk` : 단일 파일에 3개 이상 sibling import 추가 (cycle 후보).

등급 : 대부분 `warning`, `layer-violation` 의 critical 케이스(.claude→.harness 등) 는 `critical` → BLOCK.

### 3.12 design rules (Phase QF 신규, 3종)

본 3종은 `src/rules/design/` 에 위치. `quality-contract.riskProfile.uiTouched === true` 일 때만 `qualityScore.scores.ux` 에 반영.

- `accessibility-risk` : `<img>` alt 누락, `<button>` 빈 라벨, `<div onClick>` role 누락, `<a>` href 누락, `<input>` aria-label 누락.
- `design-token-violation` : 인라인 스타일 또는 css/scss 의 하드코딩 색상(`#rrggbb`, `rgba()`) 또는 두 자릿수 이상 `px` 값.
- `responsive-break-risk` : 미디어 쿼리 없는 고정 `width: 9999px`, `max-width: none`.

등급 : `<img>` alt 누락만 `high`, 나머지 `warning`.

### 3.13 release-benchmark-required (Phase QF 후속, Codex self-audit #1)

- `harness gate --mode release` 호출 시 `.harness/benchmark-results.json` 부재 또는 critical recall < 0.8 이면 발화.
- 등급 : `high` → NEEDS_HUMAN_REVIEW.

### 3.14 Worker safety findings (Phase WF, v0.5 신규)

본 6 finding 은 deterministic rule 이 아니라 gate 가 worker-result + workers.json 평가 시 직접 발화하는 gate finding. `rules/index.ts` 의 ALL_RULES 에는 등록되지 않음.

#### 3.14.1 `worker-safety-risk`

- worker result body 안에 forbidden action 패턴 (`decision.json`, `git commit`, `git push`, `harness apply`, `kubectl apply`, `terraform apply`, `audit.jsonl`) 발견.
- 휴리스틱: `src/workers/validate.ts` 의 `detectForbiddenActions`.
- 등급: `critical` → BLOCK.

#### 3.14.2 `worker-missing-required`

- `workers.json` 의 profile (minimal/standard/strict) 이 요구하는 worker role 중 `.harness/worker-runs/<task>/<role>.result.json` 이 status=completed 로 존재하지 않는 경우.
- 등급:
  - release mode + security-reviewer 누락 → `critical` → INSUFFICIENT_EVIDENCE.
  - 그 외 → `high` → NEEDS_HUMAN_REVIEW.

#### 3.14.3 `worker-role-separation`

- `validateRoleSeparation` 에서 같은 worker.id 가 분리되어야 할 두 역할을 모두 보유 (impl + security, impl + release).
- 등급: `high` → NEEDS_HUMAN_REVIEW.

#### 3.14.4 `worker-critical-finding`

- 임의 worker-result.json 의 findings 중 severity=critical 1건 이상.
- 등급: `critical` → BLOCK.

#### 3.14.5 `worker-high-finding`

- worker-result findings 중 severity=high 1건 이상 (critical 없을 때).
- 등급: `high` → NEEDS_HUMAN_REVIEW.

#### 3.14.6 `worker-factory-missing`

- release mode 인데 `workers.json` 자체가 없음.
- 등급: `critical` → INSUFFICIENT_EVIDENCE.

### 3.15 Rule pack findings (Phase RP, v0.5 신규)

#### 3.15.1 `rule-pack-missing`

- `quality-contract.template` 의 `requiredForTemplates` 에 명시된 rule pack 중 enabled 가 아닌 것이 1개 이상.
- 휴리스틱: `src/rule-packs/resolve.ts` 의 `resolveRulePacks`.
- 등급:
  - 일반 → `critical` → INSUFFICIENT_EVIDENCE.
  - web-ui template + design-web 만 단독 누락 → NEEDS_HUMAN_REVIEW (덜 엄격).

### 3.16 Quality contract findings (Phase QF, v0.4 신규)

#### 3.16.1 `quality-contract-invalid`

- `quality-contract.json` 존재하지만 schema validation 실패.
- 등급: `critical` → INSUFFICIENT_EVIDENCE (`scoreCap`).

## 4. Rule 추가/수정 절차

1. `src/rules/<new-id>.ts` 생성, `DeterministicRule` 인터페이스 구현.
2. `tests/unit/rules/<new-id>.test.ts` — positive 3, negative 3 케이스.
3. gate 모듈이 글롭으로 자동 로드. 별도 등록 불필요.
4. ROADMAP.md 에 추가 사실 기록.
5. memory 에 신규 rule 의 첫 트리거 케이스가 자동 적재되도록 케이스 ID 예약.

## 5. Human Gate 작동 방식

### 5.1 트리거 조건

다음 중 하나라도 참이면 `humanApprovalRequired = true`.

- verdict ∈ {NEEDS_HUMAN_REVIEW, BLOCK, INSUFFICIENT_EVIDENCE}.
- dangerous-file-write 또는 hook-injection-risk 또는 agent-permission-risk finding 존재.
- 어댑터 `critical` finding 존재.
- test-deletion finding 존재.
- codex-missing-risk 발화 (어댑터 부재 + 고위험).

### 5.2 승인 방법

- 파일 : `.harness/approval.txt`
- 형식 :
  ```text
  approve TASK-001 verdict=NEEDS_HUMAN_REVIEW finding=DFW-2026-05-18-001 by=mmjs1220 at=2026-05-18T10:30Z
  ```
- 규칙 :
  - taskId, verdict, finding, by, at 모두 필수.
  - 토큰 1개 = finding 1개 승인 (부분 승인 불가).
  - gate 재실행 시 verdict 또는 finding 이 바뀌면 토큰 무효화.

### 5.3 검증 알고리즘

```text
for each humanApprovalRequired finding f:
  if not exists matching token in approval.txt:
    return REFUSE
if every required finding has a matching valid token:
  return ALLOW
```

`humanApproved` 는 **모든 finding 매칭 시** 만 true.

## 6. apply 차단 보장 (다층 방어)

- **Layer 1 (CLI)** : `cli/commands/apply.ts` 표면 verdict 체크.
- **Layer 2 (Core)** : `core/apply/index.ts` schema 재검증 + verdict 재체크 + approval.txt 매칭.
- **Layer 3 (Rule)** : `rules/auto-apply-block.ts` 가 apply 진입 시점 재평가.
- **Layer 4 (Audit)** : 모든 apply 시도(성공·실패)는 `.harness/apply-log.md` 와 `.harness/audit.jsonl` 양쪽에 기록.

세 층 모두 우회되는 경로는 의도적으로 만들지 않는다. `--force`, `--yes`, `--skip-gate` 같은 플래그는 제공하지 않는다.

## 7. 보안 회귀 테스트 (Mandatory, v3)

다음 테스트는 MVP 출고 조건이며 TASKS.md `T-SEC-*` 와 매핑.

| ID | 시나리오 | 기대 |
|---|---|---|
| T-SEC-01 | secret-fallback 패턴 diff | verdict=BLOCK, apply 거부(4) |
| T-SEC-02 | auth-bypass diff | BLOCK, 거부(4) |
| T-SEC-03 | test 삭제 diff | BLOCK, 거부(4) |
| T-SEC-04 | skip 추가 diff | NEEDS_HUMAN_REVIEW |
| T-SEC-05 | src only diff | PASS_WITH_WARNINGS |
| T-SEC-06 | `.env` 변경 | NEEDS_HUMAN_REVIEW, 토큰 부재 시 거부(3) |
| T-SEC-07 | BLOCK 상태 apply | 거부(4) |
| T-SEC-08 | INSUFFICIENT_EVIDENCE 상태 apply | 거부(4 또는 2) |
| T-SEC-09 | decision.json 수동 위변조 | 모순 감지 → INSUFFICIENT_EVIDENCE 강등 → 거부 |
| T-SEC-10 | approval 토큰 mismatch | 거부(3) |
| **T-SEC-11 (v3)** | hooks.json 의 command 가 화이트리스트 외 | hook-injection-risk → NEEDS_HUMAN_REVIEW |
| **T-SEC-12 (v3)** | team.json 에서 한 agent 가 impl + security 겸직 | agent-permission-risk → NEEDS_HUMAN_REVIEW |
| **T-SEC-13 (v3)** | dangerous-file-write 발화 + codex `not_run` | codex-missing-risk → NEEDS_HUMAN_REVIEW |
| **T-SEC-14 (v3)** | 어댑터 0개 + dangerous-file-write | codex-missing-risk → INSUFFICIENT_EVIDENCE |
| **T-SEC-15 (v3)** | `harness export claude` 가 `.harness/` 외부 정보 읽기 시도 | export adapter 거부 |
| **T-SEC-16 (v3)** | export 가 `.claude/` 의 임의 입력을 `.harness/` 로 들이는 경로 | 본 경로 부재가 테스트 통과 조건 (역류 금지) |

## 8. Secret 처리 정책

- 본 도구는 어떤 외부 API 키도 하드코딩하지 않는다.
- 어댑터 설정은 `.harness/config.json` 또는 환경변수.
- `.harness/config.json` 에 토큰이 있으면 `.gitignore` 자동 등록 (init 책임).
- 로깅/리포트 출력 시 토큰으로 보이는 문자열(`[A-Za-z0-9_\-]{24,}`) 마스킹.
- `apply-log.md` 에 환경변수 값이 들어가지 않도록 화이트리스트.
- export adapter 출력에서도 동일 마스킹.

## 9. 감사 로그 (Audit Trail)

다음 행동은 `.harness/audit.jsonl` 에 한 줄씩 적재(JSON Lines).

- 모든 CLI 명령 실행(`command`, `argv`, `cwd`, `at`).
- gate 가 산출한 verdict 와 입력 해시.
- apply 시도(성공/실패), exit code, 거부 사유.
- approval.txt 변경 감지(해시 비교).
- export adapter 실행과 입력/출력 파일 경로.
- hooks 실행(특히 blocking) 의 시작/종료.

### 9.1 Chain hash (Phase C 후속 도입)

각 `audit.jsonl` 라인은 다음 두 필드를 포함한다.

- `prev_hash` : 직전 라인의 `line_hash` (없으면 `null`).
- `line_hash` : `sha256(JSON.stringify({...event, at, prev_hash}))`.

gate 가 `validateAuditChain` 으로 chain 무결성을 검증해 위반 시 `audit-integrity` finding (§3.10) 을 추가한다.

### 9.2 Audit anchor (Phase C 후속 도입)

gate 가 매 실행마다 `firstHash` / `lastHash` / `lineCount` 를 `.harness/audit-anchor.json` 에 보관. 다음 gate 가 이전 anchor 와 비교해 append-only 위반을 잡는다.

- `firstHash` 가 바뀌면 chain 재구성/리셋 → 위변조 의심.
- `lineCount` 가 감소하면 라인 삭제 → 위변조 의심.
- `lineCount` 증가 + `firstHash` 유지는 정상 (append-only).

## 10. 의존성 신뢰 모델

- 외부 npm 패키지는 ARCHITECTURE §12 의 한정 목록만 사용.
- 새 의존성 추가 조건 :
  - 주간 다운로드 ≥10k
  - 최근 12개월 내 릴리스 존재
  - 메인테이너 ≥1명, GitHub 공개
  - 라이선스 OSI 승인
- `tools/dep-policy.json` 으로 코드화(Phase B 후속).

## 11. export adapter 보안 규칙 (v3 신규)

- export 는 **단방향** (`.harness/` → `.claude/`, `.cursor/`, `.codex/`).
- 입력은 `.harness/` 내 화이트리스트 파일만 (`team.json`, `skills-map.json`, `quality-policy.md`, `orchestrator.md` 등).
- 출력 경로는 export adapter 별 화이트리스트 디렉터리 외에 쓰지 않음.
- 출력 시 secret 마스킹 동일 적용.
- export 실패가 core gate 결과를 바꾸지 않음.
- 역방향 import 경로는 본 명세에서 **금지**. 추후 도입 시 별도 ADR 와 위협 모델 갱신 필요.

## 12. 사용자 글로벌 룰과의 정합

본 문서는 `~/.claude/rules/common/security.md` 와 충돌하지 않는다.

- "Mandatory Security Checks" 8항목 → gate 의 verdict 산출에 반영(secret-fallback, auth-bypass, dangerous-file-write).
- "Secret Management" → §8 와 동일 원칙.
- "Security Response Protocol" → verdict BLOCK 발화 시 REPORT.md 자동 안내.

## 13. 본 문서가 답하지 않는 것

- 단계 시퀀스 → WORKFLOW.md
- 모듈 구조와 인터페이스 → ARCHITECTURE.md
- 팀 패턴과 agent 권한 분리 → HARNESS-DESIGN.md
- rules/hooks 의 묶음 정책 → QUALITY-POLICY.md
- 사용자 진입 경로 → README.md
- CLI 인자/플래그 상세 → CLI.md
- 구현 task 분해 → TASKS.md
