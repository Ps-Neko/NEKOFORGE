# BACKLOG

> 우선순위별 개선 목록. ROADMAP §9 의 마일스톤(M0~M8)은 모두 도달했고, 이후 경로는
> 대부분 외부 검증 게이트라 **"내부에서 지금 가능" vs "외부 수요 대기"** 로 나눈다.
> 작성 기준: `v0.5.0-alpha.6` (2026-06). 갱신: `v0.5.0-alpha.7` (2026-06-09, npm 발행 완료).

## P0 — 즉시

- [x] 커밋 1·2·3 반영 (버전 / CLI 개수 / 룰 폴더 정리) — 완료, alpha.7 발행
- [x] `RELEASE-NOTES.md` 항목 — alpha.6·alpha.7 모두 기재 완료

## P1 — 내부 개선 (외부 의존 없음)

- [x] **gate 모듈화 (2026-06-09 완료)** — index.ts 는 이전에 이미 9단계 오케스트레이터로
      분리됐고("1,075줄"은 그 시점 stale), 잔여 거대 파일 `run-helpers.ts`(978줄, src 최대)를
      책임별 6파일로 분해: `gate-types`(공유 타입) / `phase-inputs`(증거·artifact) /
      `phase-rules`(룰·audit) / `phase-synthesis`(quality·worker·pack·verdict 합성) /
      `phase-decision`(decision JSON) / `phase-outputs`(산출·audit event).
      gate/ 최대 파일 978→328, src 최대 978→532. 505 테스트 green, 행동 100% 보존.
- [ ] Quality Score 정성(LLM) 평가 2차 — `QUALITY-SCORE.md` 보류 항목 구현.
- [ ] Benchmark 외부 fixture 일반화 — 현재 local fixtures 30개 한정(recall 1.000/FP 0.000).

## P2 — 베타 진입 (외부 게이트)

- [ ] 외부 사용자 1명이 도구로 PR 1개 머지 — Beta 의 남은 *유일* 조건 (ROADMAP §10).
      모집 인프라(`ALPHA-RECRUITMENT.md`, 이슈 템플릿)는 완비 → 실제 모집이 액션.
- [ ] npm 정식(stable) 릴리스 — `alpha` 태그 배포는 완료(`private:false` / `publishConfig` / `files` 설정 + `npx nekoforge@alpha` 동작 확인). 베타 게이트(외부 PR 1건) 통과 후 stable 버전 승격 + 릴리스 체크리스트.

## 대기 (조건부 — 지금 착수 비권장)

- Phase E 다언어 확장 (수요 게이트).
- Phase F 협업 모델 (신호 2개 이상 누적 시 검토, ROADMAP §7).

## 메모

- 이 로컬 클론은 원격 `alpha.6` 보다 뒤처져 있음 → 본격 작업 전 `git fetch` 로 정합 권장.
- 영구 비-목표(ROADMAP §8) 침범 금지: 자동 commit/push/deploy, 자동 PR·머지,
  SaaS 대시보드, BLOCK/INSUFFICIENT_EVIDENCE 우회 등.
