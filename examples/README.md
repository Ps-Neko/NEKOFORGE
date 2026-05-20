# NEKOFORGE Examples — Index

> 본 디렉터리는 두 종류의 시연 자료를 담는다.
> 1. **시나리오 (01~10)** — 외부 사용자 따라하기용. 명령 시퀀스 + 기대 출력.
> 2. **Phase 흔적 (phase-*)** — 본 도구가 본 도구를 self-host 한 회차의 evidence 보존.

## 1. 시나리오 (외부 사용자 입문용)

| # | 디렉터리 | 무엇을 보여주는가 |
|---|---|---|
| **00** | **[00-first-verdict/](00-first-verdict/)** | **외부 사용자 첫 verdict 10분 walkthrough** — preset + doctor + gate |
| 01 | [01-basic-flow/](01-basic-flow/) | 30초 path — init → ask → ... → gate → apply |
| 02 | [02-blocked-by-secret/](02-blocked-by-secret/) | `secret-fallback` rule → BLOCK |
| 03 | [03-needs-human-review/](03-needs-human-review/) | `dangerous-file-write` → NEEDS_HUMAN_REVIEW + approval token |
| 04 | [04-codex-missing/](04-codex-missing/) | 고위험 변경 + review adapter 0 → INSUFFICIENT_EVIDENCE |
| 05 | [05-export-claude/](05-export-claude/) | `harness export claude` 결정적 단방향 |
| 06 | [06-quality-contract-failure/](06-quality-contract-failure/) | contract qualityBars 미충족 → verdict 강등 |
| 07 | [07-worker-dispatch/](07-worker-dispatch/) | **Phase WF** — workers init → dispatch → result import → gate |
| 08 | [08-rule-pack-missing/](08-rule-pack-missing/) | **Phase RP** — backend-api + security-core 비활성 → INSUFFICIENT_EVIDENCE |
| 09 | [09-skill-pack-web-ui/](09-skill-pack-web-ui/) | **Phase RP** — skill pack 누락 → PASS_WITH_WARNINGS (rule vs skill 차이) |
| 10 | [10-worker-role-violation/](10-worker-role-violation/) | **Phase WF** — 같은 worker.id 가 impl+security → 차단 |

## 2. Phase 흔적 (self-host 회차 evidence)

| Phase | 디렉터리 | 회차 | 주요 결과 |
|---|---|---|---|
| C dogfood | [phase-c-dogfood/](phase-c-dogfood/) | self-host #1, #2 | 9 rule 별 eval-case + M1~M3b milestone |
| Codex feedback | [phase-codex-feedback/](phase-codex-feedback/) | external #1 | 6건 식별 + 즉시 대응 |
| Codex re-review | [phase-codex-rereview/](phase-codex-rereview/) | external #2 | 3건 추가 부분 이행 (hooks/apply/memory) |
| D self-host | [phase-d-self-host/](phase-d-self-host/) | self-host #3 | real adapter 통합 + cursor/codex/generic export |
| QF self-host | [phase-qf-self-host/](phase-qf-self-host/) | self-host #4, #5 | Quality Factory Upgrade |
| Codex review #3 | [phase-codex-review-3/](phase-codex-review-3/) | external #3 | 5건 (Critical 2 + Major 2 + Medium 1) |
| Rule coverage | [phase-rule-coverage/](phase-rule-coverage/) | rule eval-case | 16 rule + 1 finding 누적 (Beta 조건 #3) |
| Self-host #6 | [phase-self-host-6/](phase-self-host-6/) | self-host #6 | Windows .cmd 결함 발견 → 즉시 해결 |
| Self-host #7 | [phase-self-host-7/](phase-self-host-7/) | self-host #7 | Phase WF/RP 자가 검증 (workerFactory 약속 발화) |
| Self-host #8 | [phase-self-host-8/](phase-self-host-8/) | self-host #8 | v0.5 외부 검증 요청 직후 자가 점검 |
| Self-host #9 | [phase-self-host-9/](phase-self-host-9/) | self-host #9 | `--with-worker-stubs` 옵션 도입 + 정직성 layer 검증 |
| Self-host #10 | [phase-self-host-10/](phase-self-host-10/) | self-host #10 | 5라운드 문서 정합 마감 후 회수 |
| Self-host #11 | [phase-self-host-11/](phase-self-host-11/) | self-host #11 | Negative fixture 5 → 10 확장 + cross-rule interference 발견 |
| Self-host #12 | [phase-self-host-12/](phase-self-host-12/) | self-host #12 | placeholder rule 10종 휴리스틱 (25→35 deterministic rule) + weakness-cleanup 마감 |

## 3. 어떻게 활용하는가

### 처음 본 도구를 보는 경우

1. `01-basic-flow` 로 정상 흐름 익히기.
2. `02-blocked-by-secret` 또는 `03-needs-human-review` 로 차단 동작 확인.
3. `07-worker-dispatch` + `08-rule-pack-missing` + `09-skill-pack-web-ui` 로 v0.5 신규 기능.
4. [GETTING-STARTED.md](../GETTING-STARTED.md) 로 본인 프로젝트 적용.

### 외부 검증 평가자

- `phase-codex-*` 디렉터리에서 본 도구가 외부 비판을 어떻게 통합했는지 회수.
- `phase-self-host-*` 에서 본 도구가 본 도구를 어떻게 평가했는지 회수.

### 본 도구에 기여

- 새 시나리오 추가는 환영 (`11-*/README.md` 형식).
- self-host 흔적 추가 시 `phase-self-host-N/README.md` + `eval-cases/M-self-host-N-milestone-passed.json` 형식.
- [CONTRIBUTING.md](../CONTRIBUTING.md) 참조.
