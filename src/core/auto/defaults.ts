/**
 * self-host / auto 공용 기본값 — DEFAULT_SPEC 과 DEFAULT_CONTRACT.
 *
 * 두 오케스트레이터(self-host.ts, auto/index.ts)가 동일한 기본 파라미터를 사용하므로
 * 단일 소스로 관리한다.
 */

export const DEFAULT_SPEC = {
  who: "본 도구를 사용하는 본인",
  why: "Codex review / Beta 조건 / 기능 변경 직후 자가 검증",
  problemIfMissing: "본 도구가 본 작업을 어떻게 평가하는지 확인 부재",
  coreFeatures: "intake → ... → gate 의 모든 단계 통과 확인",
  notDoing: "신규 기능 도입, 외부 어댑터 변경, 정책 변경",
  successCriteria:
    "verdict 가 PASS / PASS_WITH_WARNINGS / NEEDS_HUMAN_REVIEW 중 하나, 의도되지 않은 critical 0",
  failureCriteria: "BLOCK / INSUFFICIENT_EVIDENCE, 또는 audit chain 위변조 감지"
};

export const DEFAULT_CONTRACT = {
  user: "self-host 운영자 + 다음 외부 검증 사이클",
  problem: "self-host 회차의 약속 발화 / 실 결함 발견을 자동 측정",
  coreValue: "본 도구가 본 작업을 자동 PASS 시키지 않는 정직성 확인"
};
