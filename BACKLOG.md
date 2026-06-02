# BACKLOG

> 우선순위별 개선 목록. ROADMAP §9 의 마일스톤(M0~M8)은 모두 도달했고, 이후 경로는
> 대부분 외부 검증 게이트라 **"내부에서 지금 가능" vs "외부 수요 대기"** 로 나눈다.
> 작성 기준: `v0.5.0-alpha.6` (2026-06).

## P0 — 즉시

- [ ] 커밋 1·2·3 반영 (버전 alpha.6 / CLI 개수 28 / 룰 폴더 정리)
- [ ] `RELEASE-NOTES.md` 에 alpha.6 항목 추가 (버전·CLI 28·룰 폴더 security/process 정리)

## P1 — 내부 개선 (외부 의존 없음)

- [ ] **`gate/index.ts` 모듈화** — 1,075줄(2위 파일 361줄의 3배). 책임별 분리:
      rule 실행 / verdict·score 합성 / evidence·schema 검증 / REPORT 렌더.
      현재 439 테스트 안전망 확보 → 리팩터 적기.
- [ ] Quality Score 정성(LLM) 평가 2차 — `QUALITY-SCORE.md` 보류 항목 구현.
- [ ] Benchmark 외부 fixture 일반화 — 현재 local fixtures 30개 한정(recall 1.000/FP 0.000).

## P2 — 베타 진입 (외부 게이트)

- [ ] 외부 사용자 1명이 도구로 PR 1개 머지 — Beta 의 남은 *유일* 조건 (ROADMAP §10).
      모집 인프라(`ALPHA-RECRUITMENT.md`, 이슈 템플릿)는 완비 → 실제 모집이 액션.
- [ ] npm 공개 배포 준비 — `"private": true` 해제 + `files`/`publishConfig` + 배포 체크리스트.

## 대기 (조건부 — 지금 착수 비권장)

- Phase E 다언어 확장 (수요 게이트).
- Phase F 협업 모델 (신호 2개 이상 누적 시 검토, ROADMAP §7).

## 메모

- 이 로컬 클론은 원격 `alpha.6` 보다 뒤처져 있음 → 본격 작업 전 `git fetch` 로 정합 권장.
- 영구 비-목표(ROADMAP §8) 침범 금지: 자동 commit/push/deploy, 자동 PR·머지,
  SaaS 대시보드, BLOCK/INSUFFICIENT_EVIDENCE 우회 등.
