# INTEGRATIONS — OMC / ECC / Hermes 와의 관계

> 버전 0.4 · 2026-05-19 · NEKOFORGE 가 OMC / ECC / Hermes 를 **대체하지 않는다**. 각자 다른 책임을 가지고 병행한다.

## 1. 한 줄 요약

| 도구 | 책임 | NEKOFORGE 와의 관계 |
|---|---|---|
| **OMC** | 멀티 에이전트 실행 / 작업 라우팅 | OMC team/autopilot 의 산출물을 **NEKOFORGE 가 검증** |
| **ECC** | rules · hooks · skills · context · security 카탈로그 | ECC 의 패턴을 **NEKOFORGE quality-policy 에 선별 흡수** |
| **Hermes** | 장기 메모리 · 리서치 · helper | Hermes 의 결과를 **`.harness/` 의 evidence 와 별도** 로 사용 |

NEKOFORGE 의 정체성은 "Quality Contract 기반 출고 게이트" 다. 위 도구들이 만든 산출물을 신뢰하기 전에 본 도구의 14단계 + Quality Contract + Quality Score 를 통과해야 한다.

## 2. OMC 와 같이 쓰는 흐름

```text
[OMC]                                    [NEKOFORGE]
team 편성 + autopilot                  →  ask
multi-agent handoff                   →  spec / plan / harness-design
agent 가 코드 변경                       →  work (diff 캡처 + pending patch)
                                         contract / review / gate / apply
```

### 규칙
- OMC 의 agent 가 "이 작업은 완료" 라고 보고해도, NEKOFORGE 의 gate verdict 가 `PASS` 또는 `PASS_WITH_WARNINGS` 가 아니면 **apply 되지 않는다**.
- OMC 의 multi-agent 합의가 본 도구의 `Human Gate` 를 대체하지 않는다.

### 안티패턴
- OMC 가 자체적으로 `git commit` / `git push` 를 수행하면 본 도구의 차단 메커니즘 우회. OMC 호출 환경에서 자동 commit 을 비활성화해야 한다.

## 3. ECC 와 같이 쓰는 흐름

```text
[ECC catalog]                            [NEKOFORGE]
rules / hooks / skills / context  → (선별)  quality-policy 의 rules.json / hooks.json
                                            quality-contract 의 qualityBars
                                            gate 의 verdict 입력
```

### 규칙
- ECC 의 `pre-tool` hook 같은 패턴은 본 도구의 `quality-policy/hooks.json` 으로 자유 등록 가능. 단 화이트리스트(`npm/npx/tsc/git` 등) 외의 명령은 거부 (SECURITY §3.6 hook-injection-risk).
- ECC 의 거대 catalog 를 통째로 복제하지 않는다. quality-contract 단계에서 **선별** 만.

### 안티패턴
- ECC 의 모든 rule 을 켜고 quality-bar 도 낮추면 본 도구의 정체성("강제력") 약화. quality-contract 의 `qualityBars.required=true` 항목은 적극 유지.

## 4. Hermes 와 같이 쓰는 흐름

```text
[Hermes]                                 [NEKOFORGE]
장기 메모리 / 리서치                    →  intake / context 단계의 사용자 입력
helper agent                            →  본 도구의 14단계 외부에서 작동
                                         .harness/ evidence 는 별도 유지
```

### 규칙
- Hermes 의 메모리는 사용자 입력 보조 도구. 본 도구의 `.harness/memory.md` / `eval-cases/` 와는 **다른 출처**.
- Hermes 결과를 그대로 evidence 로 쓰면 안 된다. 사용자 또는 agent 가 `.harness/<artifact>` 에 명시 작성해야 본 도구의 정체성 유지.

### 안티패턴
- Hermes 의 helper 가 `.harness/decision.json` 같은 본 도구의 출력 artifact 를 직접 작성하면 안 된다. `harness gate` 가 단일 출처.

## 5. 금지 사항 (모든 도구 공통)

- ❌ OMC/ECC/Hermes 의 결과만으로 `apply` 수행
- ❌ OMC/ECC/Hermes 의 PASS 가 NEKOFORGE 의 PASS 를 강제
- ❌ OMC/ECC/Hermes 의 코드 복제 (개념·패턴만 흡수)
- ❌ `.harness/` 의 evidence 를 OMC/ECC/Hermes 가 우회

## 6. 시각화

```text
        +--------------+         +--------------+         +--------------+
        |   OMC team   |         | ECC catalog  |         |    Hermes    |
        +------+-------+         +------+-------+         +------+-------+
               |                        |                        |
               v                        v                        v
        +----------------------------------------------------------+
        |                  NEKOFORGE 14-stage process              |
        |  (ask → spec → ... → contract → work → ... → gate)        |
        +--------------------------+-------------------------------+
                                   |
                                   v
                          +----------------+
                          |  decision.json |
                          |  +qualityScore |
                          +--------+-------+
                                   |
                                   v
                          [Human Gate + apply]
```

위 그림에서 보듯, OMC/ECC/Hermes 는 **상류 정보 공급** 역할. 출고 결정은 NEKOFORGE 의 gate 가 단독으로 내린다.
