# Quality Policy (Phase C self-host)

본 변경에서는 Phase B 기본 정책을 그대로 상속한다.

## 1. 언어/프레임워크
- TypeScript 5.x, Node.js 20

## 2. 적용 rules 묶음 요약
- ts-strict, function-size (Phase B 기본과 동일)

## 3. 적용 hooks 묶음 요약
- pre-tool/ts-typecheck (blocking)
- post-tool/test-run

## 4. 검색·테스트·보안·리뷰 정책
- security-first ON (audit 가 secret 을 흘리지 않는지 검토)

## 5. 위험 파일 변경 정책
- src/cli/index.ts 변경 → no-test-risk + dangerous-file-write 우회.
  (cli/index.ts 는 dangerous 경로가 아니므로 dangerous-file-write 발화 없음)

## 6. context 정책
- 본 변경은 컨텍스트 사이즈 가드 범위 안.
