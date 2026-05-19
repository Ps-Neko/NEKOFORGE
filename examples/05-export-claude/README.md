# Example 05 — Export to Claude Code

> TASKS.md D-005 — `harness export claude` 결과 샘플.

## 입력

`.harness/team.json` 의 다음 최소 형태가 입력.

```json
{
  "schemaVersion": "0.3",
  "pattern": "Pipeline",
  "agents": [
    { "id": "impl-1", "role": "implementation-agent", "owns": ["TASK-001"] },
    { "id": "sec-1", "role": "security-reviewer", "owns": ["TASK-001"] },
    { "id": "rel-1", "role": "release-gatekeeper", "owns": ["TASK-001"] }
  ]
}
```

## 출력 (이 디렉터리)

- `.claude/agents/impl-1.md` (외 3 agent)
- `.claude/skills/search-first.md` (외 2 skill, skillsCandidates 에서 추출)
- `CLAUDE.md` — 포인터 파일

## 결정성 보장

동일 `team.json` + `skills-map.json` 입력은 동일 출력. 단위 테스트 `cursor-export.test.ts` 의 hash 비교 패턴과 같은 검증이 tests/unit/integrations/claude-export.test.ts 에 적용된다.

## 단방향

`harness export claude` 는 `.claude/` 를 **읽지 않는다**. 사용자가 `.claude/agents/impl-1.md` 를 수정해도, 다음 export 시 `.harness/team.json` 으로부터 다시 결정적으로 덮어써진다. SECURITY §11 의 역방향 import 금지 원칙.

## 재현

```bash
cd <your-project>
harness init
harness ask "..."
... (전체 흐름)
harness export claude
ls .claude/agents/
cat CLAUDE.md
```
