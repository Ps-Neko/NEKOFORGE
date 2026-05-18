# QUALITY-POLICY — 품질 운영층 매뉴얼 (v3)

> 버전 0.3 · 2026-05-18 · 본 문서는 v3 단계 `quality-policy` (WORKFLOW.md §3.7) 의 의사결정 매뉴얼이다. Everything Claude Code 의 풍부한 rules/hooks/context/security 카탈로그를 **묶음 선택** 형태로 흡수하되, 카탈로그 자체를 복제하지 않는다.

## 1. 본 단계의 책임

```text
입력  : .harness/harness-design.md, team.json, skills-map.json
처리  : 채택된 패턴·agent 후보에 맞는 rules/hooks/context/security 묶음 선택
출력  : .harness/quality-policy.md    (사람용)
        .harness/rules.json           (적용 rules)
        .harness/hooks.json           (적용 hooks)
        .harness/context-policy.md    (context 적재·제거 정책)
```

**책임이 아닌 것**:

- 신규 rule 카탈로그 생성 (그건 본 레포의 `src/rules/` 변경).
- 신규 hook 카탈로그 생성 (그건 본 레포의 `src/hooks/` 변경).
- agent routing 결정 (다음 단계 `team`).

## 2. ECC 의 어떤 것을 흡수하고 어떤 것을 거부하는가

| ECC 요소 | 흡수 | 거부 이유 |
|---|---|---|
| agents 카탈로그 | 아니오 | harness-design 단계가 담당. 본 단계는 agent 가 따를 **규칙** 만 정의 |
| skills 카탈로그 | 부분 흡수 (참조) | 사용자가 `.harness/skills.registry.md` 를 가지면 인용. 자체 생성 안 함 |
| commands 카탈로그 | 아니오 | 본 도구의 CLI 가 명령. 이중화 회피 |
| **hooks 사고방식** | 흡수 | 6 유형(pre-tool, post-tool, pre-apply, post-review, session-start, session-end) |
| **rules 묶음 (언어/프레임워크별 best practice)** | 흡수 | 본 단계의 핵심 |
| **context policy** | 흡수 | 적재·제거 시점, 컨텍스트 토큰 보호 정책 |
| **security checklist** | 흡수 | deterministic rule 과 짝지어 사용 |
| 카탈로그 숫자 경쟁 | 아니오 | PRODUCT §9 비목표 |

## 3. rules.json 구조

각 rule 은 `src/rules/` 의 deterministic rule 과는 다르다.

- `src/rules/*.ts` : 본 도구가 코드에 적용하는 **차단/경고용 휴리스틱** (9종, SECURITY §3).
- `.harness/rules.json` : 현재 프로젝트에서 **어떤 작업 규칙을 따를지** 의 묶음 선언. 예: "TypeScript strict 모드", "함수 50줄 이하", "API 응답 envelope 형식".

```json
{
  "schemaVersion": "0.3",
  "language": "typescript",
  "frameworks": ["node", "express"],
  "applied": [
    {
      "id": "ts-strict",
      "title": "TypeScript strict 모드 사용",
      "scope": ["src/**/*.ts"],
      "owner": "implementation-agent",
      "severity": "high",
      "rationale": "타입 안정성"
    },
    {
      "id": "function-size",
      "title": "함수 길이 50줄 이하",
      "scope": ["src/**/*.ts"],
      "owner": "implementation-agent",
      "severity": "warning"
    },
    {
      "id": "api-envelope",
      "title": "API 응답은 {success,data,error} envelope",
      "scope": ["src/api/**"],
      "owner": "architect",
      "severity": "high"
    }
  ],
  "deferred": [
    {
      "id": "tdd-strict",
      "reason": "MVP 에서는 강제하지 않음. Phase C 로 미룸"
    }
  ]
}
```

규칙 :

- `applied` 에 들어간 모든 rule 은 `work` 단계에서 가시화되고 `self-review` 의 점검 대상이 된다.
- `deferred` 는 명시적으로 미루는 항목. 모호한 회피용으로 사용하지 말 것.
- 각 rule 의 `scope` 는 glob.
- `owner` 는 §HARNESS-DESIGN §2 의 11 role 중 하나.

## 4. hooks.json 구조

```json
{
  "schemaVersion": "0.3",
  "hooks": [
    {
      "id": "pre-tool/ts-typecheck",
      "type": "pre-tool",
      "trigger": "before:work",
      "command": "npx tsc --noEmit",
      "blocking": true,
      "describe": "타입 오류 있으면 work 진입 차단"
    },
    {
      "id": "post-tool/test-run",
      "type": "post-tool",
      "trigger": "after:work",
      "command": "npm test",
      "blocking": false,
      "describe": "테스트는 자동 실행하되 결과는 worklog 에 기록"
    },
    {
      "id": "pre-apply/diff-summary",
      "type": "pre-apply",
      "trigger": "before:apply",
      "command": "internal:summarizeDiff",
      "blocking": false,
      "describe": "사람이 검토할 diff 요약을 apply-log 에 첨부"
    }
  ]
}
```

규칙 :

- `type` 은 6종(pre-tool, post-tool, pre-apply, post-review, session-start, session-end) 중 하나.
- `blocking: true` 인 hook 이 실패하면 해당 단계가 거부.
- `command` 가 `internal:` 로 시작하면 본 도구 내부 함수 호출. 외부 명령은 화이트리스트로 제한.

## 5. context-policy.md 의 권장 섹션

```markdown
# Context Policy

## 1. 적재 (Load)
- 현재 task 의 acceptance criteria, 관련 파일 경로만 적재.
- domain 용어집은 항상 적재.
- 보안 모듈 변경 시 SECURITY.md 도 적재.

## 2. 제거 (Drop)
- task 완료 직후 task 별 컨텍스트는 worklog 에 요약 후 제거.
- 어댑터 raw 출력은 한 번 정규화 후 원본은 별도 파일로 보관, 메인 컨텍스트에서 제거.

## 3. 보호 (Protect)
- 절대 컨텍스트에 들이지 않을 것: .env, credential, key, token.
- 자동 마스킹 대상: `[A-Za-z0-9_\-]{24,}` 매칭 문자열.

## 4. 사이즈 가드
- 컨텍스트 토큰 80% 도달 시 경고.
- 90% 도달 시 다음 work 호출 거부 (해당 task 를 더 잘게 쪼개라는 신호).
```

본 도구 자체는 컨텍스트 윈도우 관리 기능을 직접 갖지 않으나, **정책 문서를 채택하고 적용 책임을 agent 와 사용자에게 명시** 한다.

## 6. quality-policy.md 의 권장 섹션

```markdown
# Quality Policy

## 1. 언어/프레임워크
- TypeScript 5.x, Node.js 20

## 2. 적용 rules 묶음 요약
- ts-strict, function-size, api-envelope

## 3. 적용 hooks 묶음 요약
- pre-tool/ts-typecheck (blocking)
- post-tool/test-run

## 4. 검색·테스트·보안·리뷰 정책
- search-first: 신규 구현 전 코드/패키지/문서 검색 필수
- test-first: 기능 변경 시 테스트 추가 또는 변경 필수
- security-first: auth/secret/deploy 영역은 별도 security-reviewer 거침
- review-first: critical 변경은 Producer-Reviewer 패턴 강제

## 5. 위험 파일 변경 정책
- .env, credentials, CI, deploy, auth 파일은 자동 Human Gate

## 6. context 정책 (context-policy.md 요약)
- 사이즈 가드 80%/90% 임계치
```

## 7. 정책의 단계별 영향

| 정책 | 영향 단계 | 효과 |
|---|---|---|
| rules.applied | work, self-review, gate | self-review 가 각 rule 충족 점검, gate 가 violation 을 finding 으로 적재 |
| hooks (blocking: true) | work, review, apply | 실패 시 단계 거부 |
| hooks (blocking: false) | work, review, apply | 결과만 기록 |
| search-first 정책 | work 진입 시 | 신규 구현 시 검색 증거 요구 |
| test-first 정책 | work · self-review | 테스트 없는 변경은 자동 위험 플래그 |
| security-first 정책 | self-review · codex-review | security-reviewer agent 강제 호출 |
| review-first 정책 | harness-design 결과에 영향 | Producer-Reviewer 패턴 채택 시 명시 |
| context-policy | 모든 단계 | 사이즈 가드 임계치 적용 |

## 8. 9개 deterministic rule 과의 연동

본 단계의 묶음 선택은 deterministic rule 9종(SECURITY §3) 의 발화 동작과 짝지어진다.

| quality-policy 항목 | 연동되는 deterministic rule | 동작 |
|---|---|---|
| test-first 정책 ON | no-test-risk | 발화 시 verdict ≤ PASS_WITH_WARNINGS 가 아니라 NEEDS_HUMAN_REVIEW 로 격상 |
| security-first 정책 ON | dangerous-file-write, auth-bypass | 발화 시 verdict 격상 동작 강화 |
| hooks 화이트리스트 외 hook 변경 | hook-injection-risk | 발화 |
| agent permission 변경 | agent-permission-risk | 발화 |
| Producer-Reviewer 패턴 + codex 부재 | codex-missing-risk | 발화 |

본 도구의 deterministic rule 은 OFF 가 안 된다. 단, quality-policy 의 정책 선택이 발화 동작의 **강도(verdict 격상폭)** 를 정한다.

## 9. 정책 변경 절차

quality-policy 가 한 번 정해진 뒤 변경되어야 한다면 :

1. `harness policy --inherit <current>` 로 현재 정책을 베이스로 새 정책 작성.
2. 변경된 항목은 `.harness/quality-policy.md` 에 "Change Log" 섹션으로 추가.
3. `harness gate` 가 변경 사실을 evidence 에 포함.
4. 변경 자체가 위험 분류면 `dangerous-file-write` 가 본 정책 파일에도 적용된다(자기 자신 변경에 게이트).

## 10. 비-목표

- ECC 의 전체 카탈로그를 본 단계에 재현.
- 100개 이상의 rule 카탈로그 운영.
- 자동 정책 추론 (사용자 명시 선택을 요구).
- LLM 으로 정책 작성을 자동 완성 (가능하지만 MVP 비범위).

## 11. 자가 점검 체크리스트

`harness policy` 종료 직전 본 모듈은 다음을 자체 점검한다.

- [ ] rules.json 의 `applied` 가 비어 있지 않은가?
- [ ] 각 rule 의 `owner` 가 11 role 중 하나인가?
- [ ] hooks.json 의 각 `type` 이 6종 중 하나인가?
- [ ] `blocking: true` hook 의 `command` 가 화이트리스트인가?
- [ ] context-policy 의 사이즈 가드 임계치가 명시되었는가?
- [ ] security-first 정책이 ON 인 경우 harness-design 의 agents 에 `security-reviewer` 가 존재하는가?
- [ ] review-first 정책이 ON 인 경우 harness-design 의 패턴이 Producer-Reviewer 또는 Fan-out/Fan-in 인가?

위 점검 실패 시 본 단계는 거부(exit 10).

## 12. 본 문서가 답하지 않는 것

- 단계 시퀀스 → WORKFLOW.md §3.7
- agent 와 패턴 선택 → HARNESS-DESIGN.md
- deterministic rule 9종 상세 → SECURITY.md §3
- decision.json 에 들어가는 qualityPolicy 필드 → ARCHITECTURE.md §9
- 본 단계의 CLI 인자 → CLI.md `harness policy`
