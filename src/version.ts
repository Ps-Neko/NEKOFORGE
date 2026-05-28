/**
 * 엔진 버전 단일 출처.
 *
 * package.json 의 version 과 동기한다(릴리스 시 함께 갱신). gate 가 이 값을
 * gate_verdict audit 이벤트에 박아 "어느 엔진 버전이 이 verdict 를 냈는지"
 * 추적성을 남긴다(2 — engineVersion 증거 결박).
 */
export const ENGINE_VERSION = "0.5.0-alpha.4";
