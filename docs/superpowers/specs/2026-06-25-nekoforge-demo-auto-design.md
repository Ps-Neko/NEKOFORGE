# NEKOFORGE `demo auto` — 결정적 자동공장 데모 (Design Spec)

> **상태:** 설계 승인됨 · 구현 계획 전 (2026-06-25)
> **목적:** 포트폴리오 — 국내 AI 빌딩 씬에 *"작동하는 자동 공장"*을 보여준다. 제품/수익 아님.
> **한 줄:** `npx nekoforge demo auto` → 격리 샌드박스에서 14-스테이션 공장을 돌려 *목표 → (캡처된 진짜)AI 코드 → codex 리뷰 → **라이브 계산된 변조증거 verdict** → Humans-decide 게이트* 를 수초·무료·인증0으로 보여주고, `--real`로 라이브 재실행한다.

---

## 0. 맨 앞 — 이 프로젝트의 정체

자동화 *엔진*은 이미 존재한다. `nekoforge auto <goal>`(`src/core/auto/index.ts`)이 14단계 오케스트레이터로 `createClaudeWorkerAdapter`(실제 claude 구동)·`createCodexRealAdapter`(실제 codex 리뷰)·`runGate`(변조증거 verdict)·Human Gate 정지(절대 apply 안 함)까지 실연결돼 있다. 따라서 **이 작업은 "자동화를 빌드"가 아니라 "이미 있는 자동 공장을 *믿을 만한 데모로 포장*"**이다. 빌드량이 작고, "수요 없는 곳에 정교한 빌드 반복"(메타위험)을 피한다.

## 1. 결정 사항 (Settled — 브레인스토밍 합의)
1. **목적 = 포트폴리오/데모** (실제 제품 구현·다중 사용자·판매 아님).
2. **형태 = 실행하는 데모** (`npx nekoforge demo auto` 한 줄, 자가 실행 가능).
3. **실행 모드 = A: 결정적 재생 + 라이브 게이트.** 기본은 번들된 *진짜* 캡처 diff에 *실제 verdict 엔진을 라이브 계산*(무료·오프라인·수초·인증0). `--real`로 라이브 재실행(제작자/CLI 보유자, 캡처 갱신·녹화용).

## 2. 불변식 (정직성 — 타협 불가)
- **I1. verdict은 절대 가짜로 만들지 않는다.** 캡처하는 것은 *AI 산출물(diff)*뿐. verdict/triggeredRules는 매 실행마다 실제 `runGate`가 그 diff에 계산한다. (NEKOFORGE 해자 = 못 속이는 verdict — 데모에서 그걸 위조하면 자기부정.)
- **I2. 샌드박스 격리.** 재생/`--real` 어느 모드도 보는 사람의 cwd를 절대 건드리지 않는다. 데모는 전용 샌드박스에서만 동작. (현 `auto` 명령이 worker cwd=`process.cwd()`로 실제 레포를 편집하는 점을, 데모 경로에서는 샌드박스로 교정한다.)
- **I3. 모드 명시.** 출력은 기본 실행을 `재생(캡처된 실제 실행)`으로, `--real`을 `라이브`로 표기한다. "라이브인 척" 하지 않는다.
- **I4. apply 안전.** Humans-decide 게이트에서 정지. 승인 선택 시에도 적용 대상은 *샌드박스 한정*(실제 레포 아님). `runAuto`의 `onApply 절대 호출 안 함` 불변식은 유지.

## 3. 아키텍처

### 3.1 재사용 (수정 0 또는 최소)
- `src/core/auto/index.ts` `runAuto` — 14단계 오케스트레이터(엔진).
- `src/core/gate/*` `runGate` — verdict 계산(라이브).
- `src/cli/commands/demo.ts` — 기존 데모 명령(scenarios: `safety`·`productivity`). 여기에 `auto` 시나리오를 더한다.
- `src/integrations/codex/stub.ts` `createCodexStubAdapter` — 결정적 리뷰원.
- `examples/*` — 캡처 diff/fixture 출처 후보(예: `03-needs-human-review`, `00-first-verdict`).

### 3.2 신규 (최소 3개)
1. **재생 워커 어댑터** `src/workers/adapters/replay.ts`
   - `WorkerAdapter` 구현. `dispatch()`가 claude를 spawn하는 대신 **번들된 캡처 diff**를 그대로 반환(작업 결과로). `estimateCostUsd = 0`.
   - 입력: 캡처 diff 경로(또는 문자열). 출력: `runAuto`가 기대하는 work 결과 형태.
2. **demo auto 시나리오 자산** `examples/demo-auto/` (또는 기존 examples 재사용)
   - `sandbox/` — 공장이 작업할 소형 격리 소스(자기완결, 외부 의존 0).
   - 고정 `goal` 문자열(샌드박스에 비-사소한 변경을 유도, verdict가 PASS 또는 REVIEW로 룰 1~2개를 *실제로* 발동해 "rubber-stamp 아님"을 보이는 게 이상적).
   - `captured-diff.patch` — `--real` 1회로 생성한 *진짜 claude 산출물*을 fixture로 커밋(데모의 "AI가 짠 코드").
   - (선택) 캡처된 codex 리뷰 출력. 없으면 `codex-stub` 사용.
3. **`demo auto` 배선 + 내레이션** (`demo.ts` 확장)
   - 재생 모드: `runAuto({ workerAdapter: replay(캡처diff), reviewAdapter: codex-stub(또는 캡처), captureDiff: ()=>캡처diff, maxCostUsd, ... })` 를 샌드박스 cwd로 호출.
   - `--real`: `workerAdapter=createClaudeWorkerAdapter({cwd: sandbox})` + `reviewAdapter=createCodexRealAdapter()` + `captureDiff=()=>readGitDiff(sandbox)`. (cwd는 항상 샌드박스 — I2.)
   - 내레이션: 스테이션 진행 → AI diff 요약 → 리뷰 결과 → **verdict + triggeredRules** → `Humans decide: 승인?` 프롬프트. 읽기 좋되 정직(I3).

## 4. 데이터 흐름
```
demo auto
  └─ 샌드박스 준비(tmp 복제) + goal + 캡처 diff 로드
     └─ runAuto({ workerAdapter: replay(diff), reviewAdapter: stub|captured,
                  captureDiff: ()=>diff, maxCostUsd })
        └─ 14단계(tmp ws) → runGate가 *그 diff에 verdict 라이브 계산*
           └─ {verdict, triggeredRules, report}
              └─ 내레이션 출력 → Humans-decide 프롬프트
                 ├─ 승인 → 샌드박스에 적용 시연(실레포 아님)
                 └─ 거부 → 정지

--real (제작자): 위와 동일하나 worker=claude(라이브)·review=codex(라이브)·captureDiff=readGitDiff(sandbox)
                 → 캡처 diff 갱신 / 녹화·글 소재
```
재생 모드의 결정성: diff·리뷰가 fixture로 고정 → 동일 입력. verdict는 재계산이지만 (동일 diff + 동일 룰셋) 결정적.

## 5. 에러 처리
- 캡처 diff 부재/손상 → 명확한 메시지(`--real`로 재생성 안내).
- `--real`인데 claude/codex 미설치·미인증 → 감지 후 "기본 데모는 오프라인으로 실행됩니다" 안내(데모 자체는 막지 않음).
- `--real` 비용은 `maxCostUsd` 가드 적용.
- verdict가 REVIEW/BLOCK → **정상 데모 결과**(게이트가 일한다는 증거). 에러 아님.
- 샌드박스 준비 실패 → 정리 후 종료(누수 0; 현 auto의 mkdtemp 정리 패턴 따름).

## 6. 테스트
- **replay 어댑터**: 캡처 diff를 그대로 반환, cost 0.
- **오프라인 end-to-end**: `demo auto` 기본 실행이 *프로세스 spawn 0*으로 완주(라이브 미접촉).
- **verdict 결정성**: 캡처 diff의 `verdict`+`triggeredRules` 스냅샷 일치(재실행해도 동일).
- **정직성**: 기본 모드 출력이 `재생` 라벨을 포함하고 `라이브`를 주장하지 않음을 단언.
- **격리(I2)**: 데모가 `process.cwd()`를 변경하지 않음(샌드박스만).
- 기존 14단계·gate 테스트가 엔진을 이미 커버.

## 7. 범위 (YAGNI)
- **IN**: `demo auto` 재생+라이브게이트, `--real` 옵트인, 시나리오 1개, 내레이션, 샌드박스 격리, 위 테스트.
- **OUT (보류)**: 웹 시각화 · 다중 시나리오 · 녹화 자동화 · 공유 글(별도 작업) · 실제 레포 적용 · 배포 패키징.

## 8. 미결정 (구현 계획/캡처 시 확정)
1. 샌드박스 소스 + 정확한 goal 문자열 — `examples/` 재사용 vs 신규 소형 프로젝트(캡처해보고 verdict가 "흥미로운" 쪽 채택).
2. 캡처된 codex 리뷰를 fixture로 박을지 vs `codex-stub`로 충분할지.
3. 내레이션의 정확한 표현/스테이징 형식(터미널 출력 카피).

## 9. 다음 단계
구현 계획(writing-plans)으로 전환 → 위 신규 3개를 작은 검증 가능한 작업으로 분해. 첫 마일스톤 = `--real` 1회로 샌드박스에 캡처 diff 생성(엔진이 실제 한 바퀴 도는지 스파이크 겸) → replay 어댑터 → demo auto 배선 → 내레이션 → 테스트.
