# ROADMAP — Verified AI Development Harness (v3)

> 버전 0.3 · 2026-05-18 · 본 문서는 PRODUCT.md §10 성공 기준 7개를 일정에 매핑하고, 어떤 기능이 어느 단계에서 들어오는지 정한다. ROADMAP 항목 추가/삭제는 PRODUCT.md 와 정합해야 한다.

## 1. 일정 개관

```text
Phase A  : 문서 부트스트랩          (2026-05-18, 본 문서 작성 시점에 진행 중)
Phase B  : MVP 구현                 (T+1 ~ T+4 주)
Phase C  : 안정화 + 회귀 + self-hosting (T+5 주)
Phase D  : 외부 어댑터 실연결       (T+6 ~ T+7 주)
Phase E  : 다언어 확장              (T+8 주 이후, 조건부)
Phase F  : 협업 모델                (미정)
```

v2 대비 Phase B 가 1주 늘었다. 이유 : 단계 14개 + rule 9개 + harness-design/quality-policy/team 의 분리 구조로 코드량과 테스트 케이스가 늘었기 때문.

## 2. Phase A — 문서 부트스트랩 (현재)

### 산출물

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/WORKFLOW.md`
- `docs/HARNESS-DESIGN.md` (v3 신규)
- `docs/QUALITY-POLICY.md` (v3 신규)
- `docs/SECURITY.md`
- `docs/CLI.md`
- `docs/ROADMAP.md` (본 문서)
- `README.md`
- `TASKS.md`

### 종료 조건

- 9개 docs + README + TASKS = 10개 문서 모두 작성.
- 문서 간 상호 참조가 깨지지 않음(각 문서의 "본 문서가 답하지 않는 것" 정확).
- 사람이 문서만 읽고 다음 질문에 답할 수 있음.
  - "이 도구는 무엇을 강제하는가?"
  - "어떻게 그것을 강제하는가?"
  - "어떤 코드를 어디서 작성하면 되는가?"
  - "팀 패턴 6종 중 언제 어떤 것을 쓰는가?"
  - "어떤 rule/hook/context-policy 를 어떻게 묶는가?"

## 3. Phase B — MVP 구현 (T+1 ~ T+4 주)

### 목표

PRODUCT.md §10 성공 기준 7개를 만족하는 동작 가능한 CLI.

### 범위 (TASKS.md 와 동기화)

- 부트스트랩 : `package.json`, `tsconfig.json`, lint/format/test 러너.
- CLI 진입점 : 14 명령(+`export <tool>` 서브커맨드) 골격.
- core 모듈 14종 : intake → memory.
- deterministic rule 9종 (SECURITY §3).
- hook 인프라 + 6 hook type(pre-tool 등).
- review adapter 인터페이스 + stub (codex stub).
- export adapter 인터페이스 + claude export 1종 구현 (`team.json` → `.claude/agents/*.md`).
- schema 7종(decision, team, agent-routing, rules, hooks, codex-findings, eval-case).
- 출력 포매터.
- 테스트 :
  - unit : rule 9종 각 ≥6 케이스, hook type 별 ≥3 케이스, export adapter 결정성.
  - integration : CLI 명령 14종 happy path + 거부 path.
  - e2e : SECURITY §7 의 T-SEC-01 ~ T-SEC-16.

### 종료 조건 (Definition of Done)

- `npm test` 0 exit.
- README 30초 path 가 30초 안에 동작.
- T-SEC-01 ~ T-SEC-16 모두 통과.
- `harness apply --approved` 가 BLOCK/INSUFFICIENT_EVIDENCE 에서 차단됨이 자동 테스트로 증명.
- `harness export claude` 가 결정적(동일 입력 → 동일 출력) 임이 테스트로 증명.
- `dependency-cruiser` 가 ARCHITECTURE §7 의 모듈 의존성 규칙 위반 0건.

### 명시적 비-범위

- 실제 LLM 호출 (ReviewAdapter stub 만).
- 다국어 메시지.
- IDE 통합.
- 자동 commit/push/deploy.
- `.claude/` → `.harness/` 역방향 import.
- Hierarchical Delegation 패턴의 깊은 위임 케이스 (단순 1단 위임까지만).

## 4. Phase C — 안정화 + 회귀 + self-hosting (T+5 주)

### 목표

- 내부 dogfooding 으로 미탐/오탐 잡기.
- 본 도구로 본 도구의 다음 기능 개발을 1회 이상 통과시키기.

### 작업

- "audit.jsonl 위변조 감지" 기능을 정상 workflow(ask → ... → apply) 로 추가하며 self-hosting.
- memory 단계의 오탐/미탐 케이스 최소 5개 누적.
- eval-cases/*.json 5개 이상.
- 본 도구가 본 도구의 PR 1개를 verdict + Human Gate 까지 통과시킨 기록.

### 종료 조건

- Phase B 종료 조건 + 위 추가 조건.

### 통과 기록 (2026-05-18 ~ 2026-05-19)

- **self-hosting 2회 통과** : (1) audit.jsonl 자동 어펜드 추가, (2) audit chain hash + audit anchor 추가 + 문서 정합 갱신.
- eval-cases : 13건 (milestone 4 + rule 별 9건 — Beta 조건 충족).
- 외부 사용자 조건은 ROADMAP §10 Beta 영역.

## 5. Phase D — 외부 어댑터 실연결 (T+6 ~ T+7 주)

### 목표

- ReviewAdapter stub → 실제 연결(Codex 1종 또는 Claude 1종).
- ExportAdapter 추가 : `cursor` 1종.

### 작업

- `integrations/codex/real.ts` : Codex CLI 또는 API 어댑터.
- 어댑터 결과 정규화 schema 강제.
- 두 어댑터 동시 사용 시 의견 불일치 정책(보수적 정책 : 더 엄격한 결과 채택).
- 단, 둘 다 PASS 라도 deterministic rule 통과 + tests 통과 필수.
- secret 처리(SECURITY §8)가 어댑터 통신 경로에서 마스킹 동작.
- `integrations/cursor/export.ts` : `.cursor/rules/*.md` 생성.

### 종료 조건

- 어댑터 1종 이상 실 환경 동작.
- 의견 불일치 케이스 테스트 통과.
- cursor export 결과가 결정적임이 테스트로 증명.

### 통과 기록 (2026-05-18 ~ 2026-05-19)

- ReviewAdapter : codex-stub + codex-real(spawn) + claude-real(spawn) 인터페이스 구현. SpawnLike 주입으로 테스트 가능.
- ExportAdapter : claude + cursor + **codex** + **generic** 4종 (codex/generic 은 Phase D 후속).
- real adapter : timeout (30s 기본) + stderr 마스킹.
- 의견 불일치 정책 + secret 마스킹 단위 테스트 통과.

## 6. Phase E — 다언어 확장 (T+8 주 이후, 조건부)

### 진입 조건

- Phase D 종료 + 외부 사용자 또는 본인이 TypeScript 외 언어 프로젝트에서 본 도구 적용을 요청.

### 작업

- Python, Go 프로젝트에 대한 rule 휴리스틱 추가(특히 secret-fallback, auth-bypass).
- 언어 감지(파일 확장자 기반) 모듈.
- 언어별 테스트 셋 추가.

### 종료 조건

- Python/Go 중 1언어에 대해 T-SEC 시리즈 통과.
- 새 rule 추가 절차(SECURITY §4) 가 변경 없이 동작.

### 통과 기록 (2026-05-18)

- `src/utils/language.ts` 추가 (확장자 감지).
- 4개 룰 (secret-fallback / auth-bypass / test-deletion / no-test-risk) 의 휴리스틱이 Python + Go 모두 커버.
- T-SEC Python 2건 + Go 3건 = 5건 e2e 통과.

## 7. Phase F — 협업 모델 (미정)

다음 신호 중 2개 이상이 누적되면 검토.

- 2인 이상이 동일 `.harness/` 를 공유하는 use case.
- "team.json 을 사람마다 다르게 쓰고 싶다" 는 요청 누적.
- Human Gate 승인자가 1인이 아니어야 하는 시나리오.

검토 시 PRODUCT.md §5.2 "2차 사용자" 정의 갱신.

## 8. 영구 비-목표

다음 항목은 어느 Phase 에서도 도입하지 않는다. 도입하려면 PRODUCT.md 정체성부터 변경되어야 한다.

- 자동 git commit / push / deploy.
- 자동 PR 생성·자동 머지.
- 클라우드 SaaS 대시보드.
- agent 100개 카탈로그.
- LLM 자체 호스팅.
- 무인 모드(unattended)에서 BLOCK/INSUFFICIENT_EVIDENCE 우회.
- `.claude/` → `.harness/` 역방향 import.
- ECC 전체 카탈로그 복제.

## 9. 마일스톤 체크포인트

| 시점 | 마일스톤 | 측정값 |
|---|---|---|
| M0 | 문서 부트스트랩 완료 | 10개 문서 존재, 상호 참조 정합 |
| M1 | CLI 14개 명령 골격 동작 | 모든 명령 `--help` 응답 |
| M2 | rule 9종 unit test 통과 | rule 별 6 케이스 ≥ |
| M3 | gate → apply 통합 동작 | T-SEC 시리즈 50% 통과 |
| M4 | Phase B Definition of Done | T-SEC 시리즈 100% 통과 |
| M5 | self-hosting 1회 성공 | 본 도구로 본 도구 PR 통과 |
| M6 | 어댑터 1종 실연결 | Codex 또는 Claude 어댑터 real call |
| M7 | export adapter 2종 | claude + cursor |
| M8 | 다언어 1종 지원 | Python 또는 Go T-SEC 통과 |

## 10. 외부 검증 기준 (Beta · 1.0 진입 조건)

### Beta (Phase D 완료 후)

- 외부(본인 외) 사용자 1명 이상이 본 도구를 사용해 PR 1개 이상을 머지.
- 알려진 false-positive 패턴 5개 이상이 negative test 로 등록.
- 모든 rule 의 발화 사례가 memory 에 최소 1건씩 적재.

### 1.0

- Beta 조건 + 다음 :
- 사용자 3명 이상이 본 도구를 3개월 이상 지속 사용한 기록.
- 본 도구를 끄고 켠 변화로 사고 1건 이상이 회피된 사례(self-hosting 포함).
- 영구 비-목표 §8 항목 중 어떤 것도 침범하지 않음.

## 11. 진척 관리

- 본 ROADMAP 은 사람이 직접 갱신한다.
- 마일스톤 통과 시 `.harness/memory.md` 에 "milestone passed" 케이스 적재.
- 일정 지연이 1주 이상이면 PRODUCT.md §10 성공 기준 자체를 재검토(범위 축소 우선, 일정 연장은 차선).

## 12. 본 문서가 답하지 않는 것

- 제품 정체성 → PRODUCT.md
- 구조 → ARCHITECTURE.md
- 단계 흐름 → WORKFLOW.md
- 팀 패턴 매뉴얼 → HARNESS-DESIGN.md
- 품질 정책 매뉴얼 → QUALITY-POLICY.md
- 위협 모델·룰 → SECURITY.md
- CLI 명령 상세 → CLI.md
- 구체 구현 task → TASKS.md
