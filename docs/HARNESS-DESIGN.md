# HARNESS-DESIGN — 팀 아키텍처 설계 매뉴얼 (v3)

> 버전 0.3 · 2026-05-18 · 본 문서는 v3 신규 단계 `harness-design` (WORKFLOW.md §3.6) 의 의사결정 매뉴얼이다. revfactory/harness 의 "도메인 → 팀 구조 설계" 패턴을 흡수하되, 산출물은 **Claude Code 비종속** 형식으로 `.harness/` 에 저장한다. 이후 `harness export claude` 가 어댑터로 `.claude/` 형태를 생성한다.

## 1. 본 단계의 책임

```text
입력  : .harness/SPEC.md, .harness/PLAN.md, .harness/context.md
처리  : 도메인 분석 → 팀 패턴 선택 → orchestrator 설계 → skills/rules 후보 매핑
출력  : .harness/harness-design.md       (사람용)
        .harness/team.json               (역할 + 패턴, 기계용)
        .harness/orchestrator.md         (handoff 흐름)
        .harness/skills-map.json         (agent ↔ skill/rule/hook 후보)
```

**책임이 아닌 것**:

- 실제 실행 routing 결정 (그것은 다음 단계 `team`).
- rules/hooks 실제 묶음 결정 (그것은 다음 단계 `quality-policy`).
- Claude Code 의 `.claude/agents/*.md` 직접 작성 (그것은 export adapter).
- 코드 변경 (그것은 `work`).

## 2. 11개 표준 agent role

team.json 에 등장할 수 있는 role 후보. **모두 채택해야 한다는 뜻이 아니다**. 프로젝트 규모와 패턴에 따라 일부만 채택.

| role | 책임 | 자주 짝짓는 단계 |
|---|---|---|
| product-questioner | 제품 질문 강제, 모호한 요구 정리 | clarify · spec |
| domain-analyst | 도메인 용어/제약/외부 의존 분석 | context |
| architect | 시스템 구조·기술 선택·트레이드오프 | plan · harness-design |
| **harness-designer (v3)** | 팀 패턴 선택, orchestrator 설계 | harness-design |
| **quality-policy-designer (v3)** | rules/hooks/context 묶음 선택 | quality-policy |
| implementation-agent | 실제 코드 변경 | work |
| test-agent | 테스트 추가·변경·실행 | work · self-review |
| refactor-agent | 정리·통합·이름 정돈 | work (선택) |
| security-reviewer | 보안 위험 식별 | self-review · codex-review |
| **codex-review-coordinator (v3)** | 외부 ReviewAdapter 호출·결과 정규화 | codex-review |
| release-gatekeeper | gate verdict 와 apply 판단 책임자 | gate · apply |

규칙 :

- **`release-gatekeeper` 는 모든 설계에서 필수.**
- **`implementation-agent` 와 `security-reviewer` 는 동일 ID 가 될 수 없다.** (PRODUCT §7.4 독립성)
- **`harness-designer` 와 `quality-policy-designer` 는 동일 ID 가 될 수 없다.** (설계·정책 분리)

## 3. 6개 팀 패턴

### 3.1 Pipeline

```text
A ──▶ B ──▶ C ──▶ D
```

- 단계가 명확히 직렬. 각 단계 결과가 다음 단계 입력.
- **언제 쓰는가**: 데이터·문서 처리, ETL, 단계별 변환이 명확한 도메인.
- **언제 안 쓰는가**: 단계가 자주 되돌아가야 하거나 병렬화 가능 영역이 큰 경우.
- **agent 예시**: domain-analyst → architect → implementation-agent → test-agent → release-gatekeeper.
- **장점**: 디버깅 쉬움, 인과 추적 명확.
- **단점**: 병목 발생 시 전체 정체.

### 3.2 Fan-out / Fan-in

```text
       ┌──▶ B1 ──┐
A ─────┤    B2    ├──▶ C
       └──▶ B3 ──┘
```

- 한 결과를 여러 작업자로 분기 후 다시 합산.
- **언제 쓰는가**: 검토자가 여럿 필요(코드/보안/문서 동시 리뷰), 후보안 비교, 다언어 변환.
- **언제 안 쓰는가**: 분기들이 서로 강하게 의존하거나 합산 기준이 모호한 경우.
- **agent 예시**: implementation-agent → [test-agent, security-reviewer, refactor-agent] → release-gatekeeper.
- **장점**: 병렬화·다관점.
- **단점**: 합산(merge) 로직이 복잡해질 위험.

### 3.3 Expert Pool

```text
A ──▶ Router ──▶ Expert_i  (전문 분야별)
       │             │
       └─◀───────────┘
```

- 입력을 보고 전문 agent 풀에서 1명(또는 소수) 선택해 라우팅.
- **언제 쓰는가**: 입력 유형이 다양하고 각 유형마다 깊이 다른 처리가 필요(예: 언어별, 도메인별).
- **언제 안 쓰는가**: 유형 구분이 모호하거나 전문가가 1명뿐인 경우.
- **agent 예시**: ts-reviewer, py-reviewer, sql-reviewer 등으로 분기.
- **장점**: 깊이 있는 처리.
- **단점**: Router 가 잘못 라우팅하면 전체 품질 하락.

### 3.4 Producer-Reviewer

```text
Producer ──▶ Reviewer ──▶ (필요시) Producer
                 │
                 ▼
            Gatekeeper
```

- 생산자와 리뷰어 명시 분리. 리뷰어 피드백이 생산자로 되돌아갈 수 있음.
- **언제 쓰는가**: 한 작업물의 품질이 핵심(예: 보안 변경, 인증/인가 코드).
- **언제 안 쓰는가**: 생산-검토 분리가 과한 단순 변경.
- **agent 예시**: implementation-agent → security-reviewer → (수정 필요 시 implementation-agent 로 되돌림).
- **장점**: 본 도구의 "독립 검증" 사상과 가장 가까운 패턴.
- **단점**: 사이클 발생 시 종료 조건 명시 필요.

### 3.5 Supervisor

```text
       Supervisor
      ╱    │    ╲
   A      B      C
   │      │      │
   └──결과 ──────┘
            ▼
       Supervisor (재배치 또는 종료)
```

- 상위 agent 가 하위 agent 들에게 작업을 배정·재배치·결과 종합.
- **언제 쓰는가**: 작업 분해가 사전에 완전히 정해지지 않고 진행 중에 결정될 때.
- **언제 안 쓰는가**: 단계가 정적이고 직렬화 가능한 경우(Pipeline 으로 충분).
- **agent 예시**: release-gatekeeper 가 supervisor, 하위에 implementation/test/security.
- **장점**: 동적 분배.
- **단점**: supervisor 의 판단 오류가 전체에 전파.

### 3.6 Hierarchical Delegation

```text
Top-supervisor
   ├── Sub-supervisor A ── [a1, a2, a3]
   └── Sub-supervisor B ── [b1, b2]
```

- supervisor 가 또 다른 supervisor 를 가짐. 깊이 있는 위임.
- **언제 쓰는가**: 도메인이 여러 하위 도메인으로 자연스럽게 쪼개지고, 각 하위 도메인이 독립 검증이 필요할 때(예: 멀티 모듈 모노레포).
- **언제 안 쓰는가**: MVP 규모. 본 패턴은 over-engineering 위험이 큼.
- **agent 예시**: top = release-gatekeeper, sub-A = backend-architect, sub-B = frontend-architect 등.
- **장점**: 확장성.
- **단점**: MVP 에서는 사실상 사용 권장하지 않음.

## 4. 패턴 선택 의사결정 트리

```text
Q1. 단계가 거의 직렬이고 분기가 거의 없는가?
   YES → Pipeline
   NO  → Q2

Q2. 한 결과를 여러 관점에서 동시에 검토해야 하는가?
   YES → Fan-out/Fan-in
   NO  → Q3

Q3. 입력 유형이 매우 다양하고 유형별 전문가가 있는가?
   YES → Expert Pool
   NO  → Q4

Q4. 본 변경에 "독립 검증자" 가 결정적으로 필요한가? (보안·인증·결제 등)
   YES → Producer-Reviewer
   NO  → Q5

Q5. 작업 분해가 진행 중 동적으로 바뀌는가?
   YES → Supervisor
   NO  → Pipeline (기본값)

Q6. 도메인이 멀티 하위 도메인으로 자연 분할되는가?
   YES (그리고 MVP 가 아니라면) → Hierarchical Delegation
   NO  → 위 결과 유지
```

MVP 단계에서는 **Pipeline · Producer-Reviewer · Fan-out/Fan-in** 의 사용 빈도가 가장 높다.

## 5. 패턴 ↔ deterministic rule 의 상호작용

선택한 패턴에 따라 일부 deterministic rule 의 트리거가 강해진다.

| 패턴 | 강하게 트리거되는 rule | 이유 |
|---|---|---|
| Pipeline | no-test-risk | 직렬 의존이라 테스트 누락 시 전 단계 영향 |
| Fan-out/Fan-in | agent-permission-risk | 분기가 늘면 권한 표면도 늘기 쉬움 |
| Expert Pool | dangerous-file-write | 전문가별로 위험 파일 접근이 다를 수 있음 |
| Producer-Reviewer | codex-missing-risk | 리뷰어가 본 도구의 핵심이므로 외부 검증 부재 시 강한 경고 |
| Supervisor | hook-injection-risk | supervisor 의 자동 분기 로직이 hook 형태로 들어올 가능성 |
| Hierarchical Delegation | auto-apply-block | 위임 깊이가 깊을수록 우회 경로 발생 가능성 |

## 6. team.json 구조 (v3 표준)

`harness-design` 단계의 핵심 산출. `team.schema.json` 으로 검증.

```json
{
  "schemaVersion": "0.3",
  "pattern": "Pipeline | Fan-out/Fan-in | Expert Pool | Producer-Reviewer | Supervisor | Hierarchical Delegation",
  "rationale": "이 패턴을 선택한 이유 1~3문장",
  "agents": [
    {
      "id": "impl-1",
      "role": "implementation-agent",
      "owns": ["TASK-001", "TASK-002"],
      "skillsCandidates": ["search-first", "test-first"],
      "rulesCandidates": ["no-test-risk", "secret-fallback"],
      "hooksCandidates": ["pre-tool/ts-typecheck", "post-tool/test-run"]
    }
  ],
  "orchestratorRef": ".harness/orchestrator.md",
  "skillsMapRef": ".harness/skills-map.json"
}
```

규칙 :

- `agents[].role` 은 §2 의 11종 중 하나.
- `agents[].owns` 의 task-id 는 `.harness/TASKS.md` 에 존재해야 함.
- `agents[].skillsCandidates`, `rulesCandidates`, `hooksCandidates` 는 **후보**. 실제 묶음 확정은 `quality-policy` 단계.

## 7. orchestrator.md 의 형식

사람이 한눈에 보는 흐름도 + 종료 조건 + 사이클 한도.

```markdown
# Orchestrator

## Pattern
Producer-Reviewer

## Flow
1. implementation-agent → security-reviewer
2. security-reviewer.findings.critical > 0 ? 1 단계로 되돌림 : 다음
3. release-gatekeeper

## Termination
- security-reviewer 재호출 최대 2회
- 2회 후에도 critical 잔존 → release-gatekeeper 에 NEEDS_HUMAN_REVIEW 전달

## Handoff Rules
- 모든 handoff 는 .harness/worklog.md 에 한 줄 기록한다.
- agent 출력은 다음 agent 의 입력으로만 사용한다.
```

규칙 :

- **사이클 한도 명시 필수** (무한 루프 방지).
- **handoff 가 worklog 에 남는다는 약속 명시 필수**.

## 8. skills-map.json

각 agent 가 사용할 수 있는 후보 skill 매핑. 본 도구는 ECC 카탈로그를 복제하지 않으므로 여기서는 **참조 ID** 만 둔다.

```json
{
  "schemaVersion": "0.3",
  "mappings": [
    {
      "agentId": "impl-1",
      "skills": ["search-first", "test-first", "review-first"],
      "notes": "기본 3종 + 도메인 보안 시 security-first 추가"
    }
  ],
  "skillRegistry": ".harness/skills.registry.md"
}
```

`skillRegistry` 는 선택 사항. 본 도구는 자체 skill 카탈로그를 만들지 않으나, 사용자가 `.harness/skills.registry.md` 를 가지면 그 파일을 단일 출처로 인용할 수 있다.

## 9. harness-design.md 의 권장 섹션

```markdown
# Harness Design

## 1. 도메인 요약
- (3~5 문장)

## 2. 선택한 패턴
- Producer-Reviewer
- 이유: ...

## 3. 채택한 role 목록
- implementation-agent, security-reviewer, release-gatekeeper (최소 3종)

## 4. orchestrator 요약
- (orchestrator.md 의 한 단락 요약)

## 5. agent ↔ skill 후보 매핑 요약
- (skills-map.json 의 표 형태 요약)

## 6. 다음 단계 (quality-policy) 에 넘길 핵심 결정
- 어떤 rule 묶음이 필요한지 후보 (Final 은 다음 단계가 결정)
- 어떤 hook 유형이 필요한지 후보
```

## 10. 비-목표 (이 단계가 하지 않는 것)

- 실제 LLM 호출.
- `.claude/agents/*.md` 또는 `.claude/skills/*.md` 의 직접 작성.
- rules/hooks 의 **최종** 묶음 결정 (quality-policy 의 책임).
- 실행 routing 표 작성 (team 의 책임).
- 코드 변경 (work 의 책임).

## 11. 자가 점검 체크리스트

`harness design` 종료 직전 본 모듈은 다음을 자체 점검한다(실패 시 거부).

- [ ] team.json 의 `pattern` 이 §3 의 6종 중 하나인가?
- [ ] `agents[].role` 이 §2 의 11종 중 하나인가?
- [ ] `release-gatekeeper` 가 존재하는가?
- [ ] `implementation-agent` 와 `security-reviewer` 가 다른 ID 인가?
- [ ] `harness-designer` 와 `quality-policy-designer` 가 다른 ID 인가?
- [ ] `agents[].owns` 의 task-id 가 모두 TASKS.md 에 존재하는가?
- [ ] orchestrator.md 가 사이클 한도와 handoff 기록 약속을 포함하는가?
- [ ] skills/rules/hooks 가 후보 수준이고 최종 확정이 아닌가?

## 12. 본 문서가 답하지 않는 것

- 단계 순서·전이 조건 → WORKFLOW.md §3.6
- rules/hooks 의 최종 묶음 결정 방식 → QUALITY-POLICY.md
- agent-routing.json 의 실제 routing 표 → WORKFLOW.md §3.8
- decision.json 에 들어가는 teamArchitecture 필드 형식 → ARCHITECTURE.md §9
- 본 단계의 CLI 인자 → CLI.md `harness design`
