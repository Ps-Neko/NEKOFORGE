# RELEASE NOTES

## v0.4.0-alpha — Quality Factory Upgrade (2026-05-19)

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
