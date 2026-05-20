# ALPHA RECRUITMENT — 외부 검증자 모집

> Beta 진입 마지막 조건 ([ROADMAP §10](ROADMAP.md#10-외부-검증-기준-beta--10-진입-조건)): "외부 사용자 1명 이상 PR 1개 머지". 본 문서는 그 신호를 만들기 위한 모집 가이드.

## 1. 누구에게 요청할 것인가

좋은 후보 (우선순위):

1. **AI 코드 도구 (Claude Code / Codex / Cursor) 를 일상으로 쓰는 시니어 / 팀 리드** — 본 도구의 정체성 (AI 산출물 검증) 과 정확히 일치.
2. **소규모 팀 (1~5명) 의 release-gatekeeper 역할 담당자** — gate / apply 의 가치를 즉시 이해.
3. **개인 OSS 메인테이너** — `.harness/` 의 단일 사실원 + 결정적 export 가 도구 갈아치움에서 안전.

피해야 할 후보:

- 큰 조직의 CI/CD 운영자 (본 도구는 local-first 라 그쪽 요구와 충돌)
- "AI agent autopilot" 을 원하는 사용자 (본 도구는 명시적 의도)

## 2. 어떤 repo 에 적용하면 좋은가

| 적합도 | 특성 |
|---|---|
| ★★★ | TypeScript / JavaScript, 100~5000 LOC 의 작은 라이브러리/CLI, 활발한 변경 |
| ★★ | Python / Go (Phase E 다언어 지원 활성) |
| ★ | 대규모 monorepo (sub-package 단위로 시도) |

## 3. 30분 안에 얻어야 하는 결과

알파 사용자가 30분 안에 다음을 경험:

1. `nekoforge init --preset cli-tool` (또는 적합 preset) 로 `.harness/` 시드.
2. 자신의 실제 PR 또는 변경에 대해 `nekoforge gate` 호출.
3. verdict 가 PASS / PASS_WITH_WARNINGS / NEEDS_HUMAN_REVIEW / BLOCK 중 하나로 결정.
4. `REPORT.md` 와 `decision.json` 의 신호가 자신의 코드 변경과 일치하는지 인간 판단.

## 4. 사용자에게 요청할 evidence

PR 또는 issue 본문에 다음 파일/정보 첨부 요청:

### 필수

- `REPORT.md` — gate 결과 종합 보고서
- `.harness/decision.json` — verdict / triggeredRules / workerFactory / rulePacks
- `.harness/quality-score.json` — 8 영역 점수
- `docs/EXTERNAL-VALIDATION-TEMPLATE.md` 양식 채워서 제출

### 권장

- `.harness/worker-result-validation.json` (`harness worker-result validate <task>` 결과)
- `.harness/benchmark-report.md`
- 어디서 막혔는가 (단계 / 명령어 / 에러 메시지)
- false positive 발견했는가 (rule 이 잘못 발화한 사례)
- false negative 의심 (rule 이 잡았어야 하는데 못 잡은 사례)

## 5. 모집 채널

| 채널 | 메시지 톤 |
|---|---|
| GitHub Discussions | "30분 안에 본인 PR 의 verdict 받아보고 피드백 주실 분 찾습니다" |
| Twitter / X | 짧은 예시 (verdict 스크린샷) + GETTING-STARTED 링크 |
| AI 도구 사용자 커뮤니티 (Discord / Slack) | "AI 가 만든 코드 / 테스트 통과했길래 머지 → 사고" 경험 강조 |

## 6. 답례

- 알파 검증자 이름은 RELEASE-NOTES.md / CONTRIBUTING.md 에 명시 (선택).
- false positive 패턴 발견 시 fixture 로 누적되며 자동 회귀 보장.
- 본 도구가 Beta 진입 시 검증자 1차 사용 사례로 기록.

## 7. 본 문서가 답하지 않는 것

- 양식 자체 → [EXTERNAL-VALIDATION-TEMPLATE.md](EXTERNAL-VALIDATION-TEMPLATE.md)
- 알파 검증 후 PR 절차 → [CONTRIBUTING.md](../CONTRIBUTING.md)
- 본 도구 정체성 → [PRODUCT.md](PRODUCT.md)
