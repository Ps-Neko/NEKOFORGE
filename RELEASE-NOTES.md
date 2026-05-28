# RELEASE NOTES

## v0.5.0-alpha.3 — Packet × Source Map Integration (2026-05-28)

평가서 권장사항 #2 부분 대응. `packet` stage 가 source-map.json artifact 를 1급
입력으로 채택. context.md 텍스트 파싱은 fallback 으로만 유지(하위 호환).

| 영역 | 변경 |
|---|---|
| Packet | source-map.json 존재 시 relevant/tests/scripts/riskFiles 를 구조화 데이터에서 직접 로드 |
| Fallback | source-map.json 부재 시 기존 `extractSectionList(context.md)` 동작 유지 |
| Tests | source-map 우선·fallback 회귀 2건 신규 (총 450, 회귀 0) |
| Version housekeeping | `package.json` 의 0.5.0-alpha.2 버전 동기화 누락(이전 PR) 도 함께 정정 |

context 가 만든 source-map.json 이 packet 으로 1:1 흘러들면서, 두 stage 가 동일한
프로젝트 스냅샷을 공유하게 된다(텍스트 재파싱 제거).

## v0.5.0-alpha.2 — Source Map Artifact (2026-05-28)

평가서 권장사항 #1 대응. 프로젝트 스냅샷을 **1급 machine-readable artifact** 로 분리.

| 영역 | 변경 |
|---|---|
| Source map artifact | `.harness/source-map.json` (Ajv schema 검증) + `.harness/source-map.md` (사람용 요약) 생성 |
| 모듈 분리 | `src/core/source-map/` 신설. `collectProjectSignals` 등 스캔 로직을 context 에서 이동 |
| Schema | `source-map.schema.ts` 등록 (총 14개 schema) |
| Context | `runContext` 는 이제 `runSourceMap` 결과를 입력으로 받아 사람용 `context.md` 만 렌더 |
| Depcruise | `source-map/` 을 leaf 모듈로 등록(promotion 과 동일). 다른 stage 가 import 가능 |
| Tests | `tests/unit/source-map.test.ts` 5개 신규 (총 448 → 회귀 0) |

이제 packet/dispatch 등 다른 stage 는 `.harness/source-map.json` 을 직접 읽어 재사용할 수 있다.

## v0.5.0-alpha.1 — Source Packet Productivity Pass (2026-05-28)

NEKOFORGE의 중심을 "검증 도구"가 아니라 **기존 소스를 AI 작업 맥락으로 바꾸는 생산성 하네스**로 재정렬.

| 영역 | 변경 |
|---|---|
| Source packet | `harness packet <task-id>` 추가. context / intake / SPEC / PLAN / TASKS 를 묶어 AI 작업 패킷 생성 |
| Tool-specific packet | `--tool generic|codex|claude|cursor|all` 추가. Codex/Claude/Cursor에 바로 붙여넣기 쉬운 패킷 생성 |
| Context | `context --from <file>` 실제 반영 + task goal 기반 관련 파일 후보 제안 |
| Demo | `demo productivity`가 하드코딩 context 대신 실제 `runContext` + `runPacket` 흐름 사용 |
| Docs | README, `release/사용법.md`, CLI 문서를 소스 기반 생산성 흐름 중심으로 재정리 |

검증/Gate는 제거하지 않고, 생산성 흐름 뒤의 마지막 안전장치로 위치를 조정했다.

## v0.5.0-alpha — Worker Factory + Rule/Skill Pack Upgrade (2026-05-20)

### 검증 불변식 강화 — verified advisory → autopilot (2026-05-24)

코드 실측 평가에서 드러난 "주장 vs 보장" 격차를 코드 불변식으로 봉쇄(PR #65/#66, main 머지, tests 292 → 322):

| 영역 | 강화 |
|---|---|
| 미검증 = 미통과 | review `not_run`/`failed` → PASS 대신 `PASS_WITH_WARNINGS` 강등(verdict.ts). `--no-review-adapter` 도 `reviewStatus` 를 not_run 으로 강제 |
| `gate --strict` | verdict 가 clean PASS 아니면 non-zero exit (BLOCK/INSUFFICIENT=4, NEEDS_HUMAN/PWW=3). CI 게이팅용. 기본 모드는 exit 0(호환) |
| 증거 무결성 | decision.json content-hash + 입력 diff·codex findings·engineVersion 을 `gate_verdict` audit 에 결박. apply 가 재해싱 대조 → 사후 변조 거부 |
| 쓰기 경계 | fs-artifact `withinHarness` 연결 → `..` 경로탈출(.harness/ 밖 쓰기) 차단 |
| 승인 위변조 | `approval.txt` 토큰을 현재 decision hash 에 바인딩 → 오래된/다른 decision 의 승인 재사용 차단 |
| audit 위변조 | chain 재작성(prev.lastHash 소실)·anchor 삭제 감지(`detectAnchorTampering`) |

신규 스킬 `verified-gate`("슬래시 신규 금지" 정책에 따라 스킬+CLI 로). 구조적 보류 2건: rule-packs 부재 강제(opt-in 설계 — required 정책이 파일 자체에 저장), audit chain+anchor **동시** 재작성(외부 신뢰 앵커 필요 = 로컬-first 한계).

### 9점 미만 영역 9점화 (2026-05-20)

7 Phase 일괄 — 외부 사용자 유치 / brand 정합성 / placeholder rule 휴리스틱 등 외부 신호 외 자체 가능 영역 마무리:

| Phase | 영역 | 산출 |
|---|---|---|
| UX | 즉시 사용성 | `harness doctor` (12 검사) / `harness init --preset <cli-tool\|web-ui\|backend-api\|library>` / README quick path 10-minute first verdict |
| WF-2 | Worker Factory 실행력 | `harness dispatch --all` + worker-run-manifest / `harness worker-result validate` / gate missing worker fix-hint 자동 첨부 / `docs/FUTURE-WORKER-RUNTIME.md` |
| RP-2 | Rule/Skill Pack 풍부함 | 5 신규 rule pack (docs-quality / release-evidence / api-safety / frontend-accessibility / dependency-risk) + 6 신규 skill pack (testing-quality / security-review-writing / architecture-review-writing / release-note-writing / migration-writing / external-review-prep) + audit 강화 |
| DX | 브랜드 정합성 | `package.json` bin: nekoforge + harness alias / CLI description NEKOFORGE 전면 / package-bin 회귀 테스트 |
| EV | 외부 검증 준비도 | `docs/ALPHA-RECRUITMENT.md` + `docs/EXTERNAL-VALIDATION-TEMPLATE.md` + `.github/ISSUE_TEMPLATE/external-validation.yml` |
| QA | benchmark 신뢰도 | fixture 25 → 30 (api-safety 2 + dependency 3) + group 별 recall/FP rate / "local fixtures" 표현 정착 |
| Self-Review | external Codex v0.5 (메타 한계 명시) | Finding #H1 (canWriteDecision/canApply schema const false) + #M1 (detectForbiddenActions 부정형 회피) |

### Placeholder rule 7 휴리스틱 + WF-3 prototype + 00-first-verdict

추가 라운드:

| 영역 | 신규 |
|---|---|
| Deterministic rule | docs/stale-count-risk (info) / release-evidence/missing-release-note / api/missing-rate-limit / api/unsafe-error-exposure / dependency/postinstall-script / dependency/new-runtime-dependency (info) / frontend/interactive-div |
| Phase WF-3 prototype | `src/workers/adapter.ts` interface + shellWorkerAdapterStub (auto-spawn 명시 거부) + resolveWorkerAdapter |
| 외부 사용자 진입 | `examples/00-first-verdict/` 10분 walkthrough |

총 deterministic rule **25종** (9 security + 4 arch + 3 design + 3 api-safety + 3 dependency + 1 docs + 1 release-evidence + 1 frontend). Rule pack **13** / Skill pack **13** / CLI **26** (doctor 포함) / tests **292** / benchmark **30/30**.

### Self-host 회차 누적 (v0.4→v0.5 동안 #6~#11)

| 회차 | 발견·해결 |
|---|---|
| #6 | **Windows .cmd 해상도 결함** 발견. `resolveExecutable` + `cmd.exe /c` 우회로 즉시 해결 (shell:false 정책 유지). |
| #7 | Phase WF/RP 머지 직후 자가 검증. `workerFactory.status=missing` + `worker-missing-required` 정확 발화. self-host CLI 가 workers init / rule-pack audit / skill-pack audit 자동 호출하도록 보강. |
| #8 | v0.5 외부 Codex 검증 요청 직후 자가 점검. NEEDS_HUMAN_REVIEW + worker-missing-required (정확). |
| #9 | `harness self-host --with-worker-stubs` 옵션 추가. 3 worker stub 시드 시 worker 신호 해소 + failedBars 강등 유지 (정직성 보존). |
| #10 | 문서 정합 마감 검증 (README/ARCHITECTURE/WORKFLOW/SECURITY/HARNESS-DESIGN/QUALITY-POLICY/TASKS 갱신 회수). |

### Summary

Phase WF (Worker Factory) + Phase RP (Rule/Skill Pack) 도입.
NEKOFORGE 의 정체성: **"AI 작업자를 배치하고 / 룰·스킬팩을 적용하고 / Quality Contract 기준으로 점수화한 뒤 / Human Gate 전에는 출고 차단하는 local-first AI Development Factory"**.

### Breaking changes

- `decision.json` `schemaVersion` 0.4 → **0.5**.
- `quality-contract.json` / `quality-score.json` 도 0.5.
- gate decision 에 새 필드: `workerFactory`, `rulePacks`, `skillPacks`.

### Phase WF — Worker Factory

| 영역 | 산출 |
|---|---|
| 문서 | `docs/WORKER-FACTORY.md`, `docs/WORKER-SAFETY.md` |
| 스키마 | `workers.schema.ts` (profile + roleSeparation), `worker-result.schema.ts` |
| Core | `src/workers/{types,index,dispatch,validate,result}.ts` |
| CLI | `harness workers <init\|list\|status\|validate>`, `harness dispatch`, `harness worker-result <import\|list\|show>` |
| Worker 8종 | product-questioner, architect, implementation-worker, test-worker, refactor-worker, security-reviewer, design-reviewer, release-gatekeeper |
| 강제 | impl ↔ security/release 분리 + forbidden action 감지 + worker 가 decision/apply 절대 불가 |
| Profile | minimal / standard / strict |
| gate 영향 | requiredWorkers 누락 / role 위반 / critical finding / forbidden action → verdict 강등 |

### Phase RP — Rule/Skill Pack

| 영역 | 산출 |
|---|---|
| 문서 | `docs/RULE-PACKS.md`, `docs/SKILL-PACKS.md` |
| 스키마 | `rule-packs.schema.ts`, `skill-packs.schema.ts` |
| Core | `src/rule-packs/{catalog,index,resolve}.ts`, `src/skill-packs/{catalog,index,render}.ts` |
| CLI | `harness rule-pack <list\|enable\|disable\|status\|audit>`, `harness skill-pack <…>` |
| Rule pack 8종 | security-core, test-discipline, architecture-core, design-web, release-strict, ai-generated-code-risk, worker-safety-core, quality-contract-core |
| Skill pack 7종 | typescript-quality, backend-api-quality, web-ui-quality, cli-tool-quality, library-quality, release-readiness, evidence-writing |
| 자동 추천 | quality-contract template (web-ui/backend-api/cli-tool/library) 별 required pack |
| gate 영향 | required pack 누락 → INSUFFICIENT_EVIDENCE (web-ui+design-web 만 누락 시 NEEDS_HUMAN_REVIEW) |

### CLI count

19 → **24** (workers, dispatch, worker-result, rule-pack, skill-pack — 모두 subcommand 패턴).

### Tests

240 → **266** (+26):
- workers validate / forbidden action 단위 6
- rule-pack catalog/resolve 단위 8
- skill-pack catalog/render 단위 4
- T-WF/T-RP e2e 8

### Dependency rules

`src/workers/`, `src/rule-packs/`, `src/skill-packs/` 모두 leaf 디렉터리. gate 는 이들만 import 가능. cross-stage core 위반 0건 유지.

### Migration

```bash
# 기존 워크스페이스 마이그레이션
$ harness workers init --profile standard
$ harness rule-pack audit       # 기본 enabled pack 자동 생성
$ harness skill-pack audit      # 기본 enabled pack 자동 생성

# release mode 진입 전
$ harness rule-pack enable release-strict
$ harness workers init --profile strict --force
```

### Known limits (의도된)

- worker 자동 LLM 실행 미포함 — prompt 생성 + result import 만 (Phase WF-2 예약).
- skill pack 은 직접 verdict 만들지 않음 (rule pack 만 verdict 영향).
- 8 rule pack + 7 skill pack 의 카탈로그는 큐레이션 — ECC 식 마켓플레이스 미지향.

---

## v0.4.0-alpha — Quality Factory Upgrade (2026-05-19)

### self-host #6 (2026-05-19) — 실 결함 1건 발견·즉시 해결

Codex review #3 + Beta 조건 #2/#3 처리 직후 본 도구로 본 작업을 14단계 회수. verdict NEEDS_HUMAN_REVIEW + apply exit 3 (approval 부재) 로 자가 정직성 확인. 도중 실 결함 1건 발견·해결:

| 영역 | 상세 |
|---|---|
| **결함** | Windows 의 hook runner 가 `npx tsc --noEmit`, `npm test` 같은 .cmd 명령을 spawnSync(shell:false) 로 실행 시 status=null 로 실패. 정상 환경에서도 pre-tool hook 차단. |
| **원인 1** | Windows 에서 npm/npx/yarn 등은 .cmd 파일이며 PATHEXT 자동 탐색 미동작. |
| **원인 2** | Node.js 20+ 의 CVE-2024-27980 fix 가 .cmd/.bat 의 shell:false 실행을 EINVAL 로 차단. |
| **해결** | `resolveExecutable(cmd, platform)` 헬퍼 + `.cmd`/`.bat` 시 `cmd.exe /c <cmd> <args...>` 우회. shell:false 정책 유지. |
| **보안 근거** | isAllowedCommand 셸 메타 차단 + args 토큰 분리 + cmd.exe argv 직접 전달 → DEP0190 결합 위험 회피. |

### self-host #6 후속 — tests.status 자동 추정

post-tool hook (npm test 등) 결과가 work 단계에서 버려지던 문제 보완:
- work 가 post-tool 결과를 `.harness/hook-results.json` 에 보존.
- gate 의 `inferTestStatusFromHooks` 가 `npm/yarn/pnpm/bun test` 류 명령 결과로 tests.status 자동 추정 (ok→passed / failed→failed).
- CLI `--test-status` 명시값은 항상 우선.

### Codex review #3 (2026-05-18) — 5건 대응

외부 Codex 가 QF self-host 결과를 재검증해 QF 의 핵심 강제 조건 5건이 아직 뚫린다고 지적. main 통합 완료:

| # | 항목 | 심각도 | 처리 |
|---|---|---|---|
| 1 | `quality-contract.json` / `quality-score.json` 없이도 apply 통과 | **Critical** | apply Evidence before Apply 강화 — contract/score/REPORT 존재 + schema valid + decision.qualityContract/qualityScore status 까지 검증 |
| 2 | contract schema invalid 가 verdict 미반영 | **Critical** | gate 가 `quality-contract-invalid` critical finding + `scoreCap = INSUFFICIENT_EVIDENCE` |
| 3 | UI 감지가 `riskProfile.uiTouched` 플래그 only | **Major** | diff 파일 경로 자동 감지 (`detectUiInDiff`: `.tsx/.jsx/.css/.scss/.sass/.html` 또는 `components/app/pages/ui` 디렉터리) |
| 4 | factory/architecture/design 결과가 REPORT.md 안에만 | **Major** | gate 가 5개 독립 산출 파일 작성: `factory-cells.{json,md}`, `architecture-{findings.json,review.md}`, `design-{findings.json,review.md}` |
| 5 | decision schemaVersion 0.3 그대로 | Medium | `schemaVersion: "0.4"` 갱신 + 테스트 시드 일괄 갱신 |

흔적: `examples/phase-codex-review-3/README.md`. 테스트: 227/227 (이전 223 + drift seed 보강 4).


### Summary

NEKOFORGE 의 정체성을 **"AI 변경 검증·차단 도구"** 에서 **"Quality Contract 기반 Local-first AI Development Factory"** 로 진화. 차단 중심 → 품질 압력 중심.

### Breaking changes

- `decision.json` `schemaVersion` 0.3 → **0.4**.
- `harness work <task>` 가 **`quality-contract.json` 부재 시 거부** (Phase QF 강제 — Quality Contract before Work).
- `gate` 는 verdictBase 와 quality-score 의 scoreCap 중 더 보수적인 것 채택.

### New features

| 영역 | 산출 |
|---|---|
| Quality Contract | `harness contract --template <web-ui\|cli-tool\|backend-api\|library\|custom>`, `.harness/QUALITY-CONTRACT.md`, `quality-contract.json` (schema 검증) |
| Quality Score | 8 영역 정량 점수 (correctness/testCoverage/security/maintainability/architecture/ux/performance/evidence), `.harness/quality-score.json`, scoreCap 으로 verdict 강등 |
| Factory Cells | `decision.json.factoryCells` (product/architecture/build/quality/review/gate 상태) |
| Architecture rules | `large-file-risk` / `layer-violation` / `untyped-api-risk` / `circular-dependency-risk` |
| Design rules | `accessibility-risk` / `design-token-violation` / `responsive-break-risk` (uiTouched 시만) |
| Benchmark | `harness benchmark [--group <name>]`, fixture 기반 critical recall / FP rate 측정 |
| Modes | `harness run --mode <fast\|safe\|release>` (명령 시퀀스 안내) |
| Memory CLI | `harness memory add --kind <K> --summary <S>` |
| OMC/ECC/Hermes 통합 문서 | `docs/INTEGRATIONS-OMC-ECC-HERMES.md` — 대체 아니라 병행 |

### New CLI count

14 → **18** (init, ask, context, spec, plan, design, policy, team, work, review, gate, apply, report, export, memory, contract, benchmark, run). PRODUCT.md §11 의 정체성 한계와 정확히 일치.

### Documentation

신규 5종 :
- `docs/QUALITY-CONTRACT.md`
- `docs/QUALITY-SCORE.md`
- `docs/FACTORY-CELLS.md`
- `docs/BENCHMARKS.md`
- `docs/INTEGRATIONS-OMC-ECC-HERMES.md`

갱신 : `README.md` (정체성 재정의), `docs/ROADMAP.md`, `docs/SECURITY.md` (§0 책임 경계), `docs/CLI.md` (export 4종, contract, benchmark, run).

### Tests

223/223 통과 (이전 200 + Phase QF 신규 23):
- `qf-contract-score.test.ts` (8): contract precond/schema/check, work reject, score clean/security, hint required/below60
- `qf-rules.test.ts` (12): architecture 4 rule × 3 + design 3 rule × 평균 1
- `qf-benchmark.test.ts` (2): fixture scan + group filter
- `eval-cases-schema.test.ts` (1 갱신): examples 모든 디렉터리 스캔

### Dependency rules

`src/scoring/` 신규 디렉터리 (core/quality-score → src/scoring 으로 이동, cross-stage core import 회피). dependency-cruiser 위반 0건 유지.

### Migration

v0.3 → v0.4 사용자 :

```bash
# 1. 기존 워크스페이스에서 14단계 진행 중이라면 work 전에 contract 실행
$ harness contract --template <template>

# 2. gate 재실행 → quality-score.json 자동 생성
$ harness gate

# 3. 새 fixtures/ 디렉터리에 자체 시나리오 추가 후 benchmark
$ harness benchmark --group security
```

기존 `.harness/decision.json` 은 schemaVersion 0.3 으로 남아 있어도 동작. 다음 gate 호출 시 0.4 로 갱신.

### Known limits (의도된)

- `ux` / `performance` 점수의 신뢰도 낮음 — LLM 호출 없이 정량 평가 어려움. 가중치 0.05 로 영향 제한.
- `harness run --mode` 는 시퀀스 안내만, 실제 명령 실행은 사용자 책임.
- 산출물의 **내용** 은 사용자/agent 가 채워야 함 (본 도구는 골격만 책임 — SECURITY.md §0).

### 외부 검증

- Codex feedback 2회 (self-host #3, #4) 가 main 에 통합됨.
- 외부 PR 1건 이상 누적은 ROADMAP §10 Beta 영역.

### Phase 진척

| Phase | 상태 |
|---|---|
| A 문서 부트스트랩 | ✓ |
| B M1~M3b MVP | ✓ |
| C self-host + memory | ✓ |
| D real adapters + cursor export + 후속 (codex/generic export, anchor) | ✓ |
| E 다언어 (Python/Go) | ✓ |
| **QF Quality Factory Upgrade** | ✓ **(v0.4)** |
| F 협업 모델 | 보류 (외부 수요 조건부) |
