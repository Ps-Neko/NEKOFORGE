# Example 09 — Skill Pack (Web UI) Recommendation

> Phase RP 의 skill pack 자동 추천 + verdict 약한 압력 흐름.

## 시나리오

web-ui template 의 contract 인데 `web-ui-quality` skill pack 이 disabled.

## 1. 초기화

```bash
$ harness contract --template web-ui --task TASK-001
$ harness skill-pack audit
[ok] skill-packs.json present. enabled: typescript-quality, evidence-writing
```

## 2. 추천 확인

```bash
$ harness skill-pack status
configured: true
enabled: typescript-quality, evidence-writing
disabled: (none)
template recommendations:
  web-ui: typescript-quality, web-ui-quality, evidence-writing
  backend-api: typescript-quality, backend-api-quality, release-readiness, evidence-writing
  cli-tool: typescript-quality, cli-tool-quality, evidence-writing
  library: typescript-quality, library-quality, release-readiness, evidence-writing
```

→ web-ui 는 `web-ui-quality` 권장. 현재 enabled 에 없음.

## 3. Gate (skill pack 만 누락 — rule pack 은 정상)

```bash
$ harness gate --task TASK-001
[verdict] PASS_WITH_WARNINGS
```

decision.json.skillPacks:

```json
{
  "status": "partial",
  "enabled": ["typescript-quality", "evidence-writing"],
  "recommended": ["typescript-quality", "web-ui-quality", "evidence-writing"],
  "missingRecommended": ["web-ui-quality"]
}
```

## 4. 차이 (rule pack 과 비교)

- **rule pack missing** → INSUFFICIENT_EVIDENCE (강한 차단)
- **skill pack missing** → PASS_WITH_WARNINGS (약한 압력, 직접 BLOCK 아님)

## 5. 활성화

```bash
$ harness skill-pack enable web-ui-quality
[ok] enabled. now: typescript-quality, evidence-writing, web-ui-quality

$ harness gate --task TASK-001
[verdict] PASS_WITH_WARNINGS  # 또는 PASS (다른 신호에 따라)
```

## 6. Skill pack 의 역할

Skill pack 은 verdict 를 만들지 않고 worker prompt 에 가이드를 주입한다 (`src/skill-packs/render.ts`).

```typescript
// 예: dispatch 가 skill pack 을 worker prompt 에 흡수
const guidance = renderSkillGuidance(enabledPacks);
// → "## web-ui-quality\n- accessibility — alt, aria-label 명시\n..."
```

worker 가 받은 prompt 에 가이드가 포함되어 작업 결과의 quality 가 자연스럽게 올라간다.
