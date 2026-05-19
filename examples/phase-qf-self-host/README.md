# Self-host #5 — Quality Factory Upgrade

> NEKOFORGE 가 자기 자신을 "Quality Contract 기반 AI 개발 공장" 으로 진화시킨 회차.
> 입력 : `C:\Users\ILJIN\Downloads\NEKOFORGE_Quality_Factory_Upgrade_Prompt.md` (v1).
> 산출 : Phase QF — 17 task (QF-001 ~ QF-017) 완료, v0.3 → v0.4.

## 14단계 흔적 요약

| 단계 | 본 회차의 결정 |
|---|---|
| intake | "차단 중심 → 품질 압력 중심 진화. NEKOFORGE 를 Quality Contract Factory 로 재정의" |
| clarify | 4축 (대상=AI 개발자, 문제=좋은 산출물 반복 생산 안 됨, 성공=정량 점수, 하지않을것=ECC 카탈로그화) |
| context | 기존 NEKOFORGE v0.3 의 한계 + OMC/ECC/Hermes 와의 병행 관계 정리 |
| spec | 7문항 — "사용자=시니어 개발자/소규모 팀 리드", "왜=차단 + 품질 압력 동시 필요", "비목표=agent catalog/runtime", "성공=PASS 전 점수 강제", "실패=18 한계 초과 또는 정체성 변질" |
| plan | TASK-QF-001 ~ TASK-QF-017 분해 (4 라운드) |
| design | Pipeline (변경 규모 큼이지만 단계 간 강제 결합 적음) |
| quality-policy | 기본 정책 유지 + Quality Contract 가 새로 강제 추가 |
| team | impl-1 / sec-1 / rel-1 (변경 없음) |
| **contract** | 신규 단계 자체가 이 회차의 산출. 의미적으로 자기참조 — 본 회차 자체가 quality-contract 의 첫 사용 사례 |
| work | 라운드 1~4 (commit 4건): contract+score, factory cells + arch/design rule, benchmark+modes+integ doc, examples+tests+README |
| self-review | 6 항목 자체 점검 + Codex feedback round (#3, #4) 가 이미 강제력 약점을 잡았던 사례 |
| codex-review | codex-stub passed. 실 외부 Codex 점검은 ROADMAP 의 Beta 영역에서 후속 |
| gate | verdict = PASS_WITH_WARNINGS (no-test-risk 가능). quality score : evidence/correctness/security 만점에 가까움 |
| apply | 통과 (drift 없음 — 14단계 자체가 본 도구의 변경) |
| memory | 본 디렉터리 eval-cases/ 에 milestone + improved_prompt 적재 |

## 의미적 변화

### "차단" 에서 "품질 압력" 으로

- 이전: critical rule finding → BLOCK 차단. "사고 안 일어나는" 도구.
- 이후: critical 외에도 **8 영역 정량 점수** 가 verdict 상한을 잡음. "**좋은 산출물 반복 생산**" 을 강제.

### CLI 18 명령 정체성 한계 도달

PRODUCT.md §11 의 "CLI 18개 한계" 가 v0.4 에서 정확히 충족. 신규 명령(contract/benchmark/run/memory add) 만큼 정체성 한계도 22 로 갱신 (4 여유).

### OMC/ECC/Hermes 와의 관계 명문화

- 이전: 7개 축 흡수 (모호한 가족 관계)
- 이후: docs/INTEGRATIONS-OMC-ECC-HERMES.md 에 "대체 아닌 병행" 명시. NEKOFORGE 는 출고 게이트, 그 도구들은 상류 정보 공급.

## 통과 기록

- `npm test` : **223/223 통과** (이전 200 + Phase QF 23)
- `npm run lint` : 0 위반
- `npm run depcheck` : 98 modules, 256 deps, 위반 0
- `decision.json` schemaVersion 0.3 → **0.4**
- CLI 명령 14 → **18**

## eval-cases

- `M-self-host-5-phase-qf.json` — Phase QF 17 task 완료 기록
- `phase-qf-prompt-input.json` — 입력 프롬프트의 핵심 결정 사항 보존
