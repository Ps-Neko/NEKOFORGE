# Harness Design

## 1. 도메인 요약

CLI 자체의 관측·감사. 메인 데이터 흐름의 옆 가지(side-channel) 이므로
도메인 침투 영향은 낮다.

## 2. 선택한 패턴

- Pipeline
- 이유: 작은 단계가 직렬로 이어진다(audit 모듈 → cli 어펜드 → gate/apply 이벤트).
  Producer-Reviewer 패턴은 본 변경 규모에 비해 과하다.

## 3. 채택한 role 목록

- implementation-agent (audit 모듈 + cli 진입/종료)
- security-reviewer (audit 가 secret 마스킹과 충돌 없는지 검토)
- release-gatekeeper (T-SEC 회귀 확인)

## 4. orchestrator 요약

Pipeline 단일 흐름. 사이클 0회.

## 5. agent ↔ skill 후보 매핑 요약

- implementation-agent: search-first, test-first
- security-reviewer: review-first, security-first

## 6. 다음 단계 (quality-policy) 에 넘길 핵심 결정

- 새 rule 추가 없음 (기존 9개 그대로).
- 새 hook 추가 없음.
- context-policy 변경 없음.
