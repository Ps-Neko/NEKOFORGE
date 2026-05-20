# RELEASE NOTES

## v0.5.0-alpha — Worker Factory + Rule/Skill Pack Upgrade (2026-05-20)

### Self-host 회차 누적 (v0.4→v0.5 동안 #6~#10)

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
