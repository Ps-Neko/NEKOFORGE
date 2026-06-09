/**
 * SECURITY.md §3.3 — 테스트 삭제 또는 skip 마커 추가.
 */
import type { DeterministicRule, RuleFinding } from "../types.js";
import { makeFinding } from "../types.js";

const RULE_ID = "test-deletion";

const TEST_PATH_RE = /(^|\/)tests?\//;
const TEST_FILE_RE =
  /(\.test\.|_test\.|\.spec\.)[tj]sx?$|(^|\/)test_[^/]+\.py$|_test\.py$|_test\.go$/;

const SKIP_MARKERS = [
  // TS/JS
  ".skip(",
  "xdescribe(",
  "xit(",
  "test.skip(",
  "it.skip(",
  // 대량 비활성: .only( 는 나머지 테스트를 사실상 끈다.
  ".only(",
  "test.only(",
  "it.only(",
  "describe.only(",
  "fdescribe(",
  "fit(",
  // Python
  "pytest.mark.skip",
  "@pytest.mark.skip",
  "@unittest.skip",
  // Go
  "t.Skip(",
  "t.SkipNow(",
  "b.Skip(",
  // Java
  "@Disabled",
  "@Ignore"
];

/**
 * 각 마커를 공백 허용 정규식으로 컴파일한다.
 * 예: ".skip(" → /\.skip\s*\(/ 로 `.skip (`(공백) 우회를 잡는다.
 * 표시용 라벨은 원본 마커를 유지한다.
 */
const SKIP_MARKER_RES: ReadonlyArray<readonly [RegExp, string]> = SKIP_MARKERS.map(
  (m) => {
    const escaped = m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // 마지막 "(" 앞에 \s* 를 허용 (마커가 "(" 로 끝나는 경우).
    const pattern = m.endsWith("(")
      ? escaped.replace(/\\\($/, "\\s*\\(")
      : escaped;
    return [new RegExp(pattern), m] as const;
  }
);

function isTestPath(path: string): boolean {
  return TEST_PATH_RE.test(path) || TEST_FILE_RE.test(path);
}

/** 러너가 실제로 실행하는 test 파일인지 (파일명 기반). */
function isRunnableTestFile(path: string): boolean {
  return TEST_FILE_RE.test(path);
}

/**
 * 추가된 라인 중 "의미 있는" 코드 라인 수.
 * 빈 줄 / 주석 / 단순 describe·suite 껍데기는 제외 — 1줄 추가로 shrink 체크를
 * 무력화하는 우회를 막기 위함.
 */
function significantAddedCount(addedLines: string[]): number {
  return addedLines.filter((raw) => {
    const l = raw.trim();
    if (l === "") return false;
    if (l.startsWith("//") || l.startsWith("#") || l.startsWith("*") || l.startsWith("/*")) {
      return false;
    }
    // describe/suite/context 껍데기 (단언 없는 그룹 선언) 만 있는 라인은 사소.
    if (/^(export\s+)?(describe|suite|context)\b/.test(l)) return false;
    if (l === "});" || l === "}" || l === "{" || l === ")" || l === "(") return false;
    return true;
  }).length;
}

export const testDeletionRule: DeterministicRule = {
  id: RULE_ID,
  describe: "테스트 파일 삭제 또는 skip 마커 신규 추가 탐지",
  async run(ctx) {
    const findings: RuleFinding[] = [];

    for (const f of ctx.diff.files) {
      if (f.status === "deleted" && isTestPath(f.path)) {
        findings.push(
          makeFinding(
            RULE_ID,
            "critical",
            `test file deleted: ${f.path}`,
            { file: f.path }
          )
        );
        continue;
      }

      // 테스트 파일을 비-test 확장자로 이름변경해 게이트 밖으로 파킹하는 우회.
      // 판정: 기존 경로는 러너가 인식하는 test 파일(TEST_FILE_RE)인데
      // 새 경로는 더 이상 러너가 인식하지 못함 (확장자 변경 등).
      if (
        f.status === "renamed" &&
        f.oldPath !== undefined &&
        isTestPath(f.oldPath) &&
        !isRunnableTestFile(f.path)
      ) {
        findings.push(
          makeFinding(
            RULE_ID,
            "critical",
            `test file renamed out of test scope: ${f.oldPath} -> ${f.path}`,
            { file: f.path }
          )
        );
        continue;
      }

      // skip/only 마커 스캔은 테스트 경로 파일에만 적용한다 —
      // 프로덕션 코드의 ORM `query.skip()` 이나 주석 속 `t.Skip(` 오발화 방지(FP).
      if (isTestPath(f.path)) {
        f.addedLines.forEach((line, idx) => {
          for (const [re, label] of SKIP_MARKER_RES) {
            if (re.test(line)) {
              const wasPresent = f.deletedLines.some((d) => re.test(d));
              if (!wasPresent) {
                findings.push(
                  makeFinding(
                    RULE_ID,
                    "high",
                    `skip marker added: ${label}`,
                    { file: f.path, line: idx + 1 }
                  )
                );
              }
            }
          }
        });
      }

      if (f.status === "modified" && isTestPath(f.path)) {
        const delta = f.addedLines.length - f.deletedLines.length;
        // 1줄(주석/빈줄/describe 껍데기) 추가로 shrink 체크를 무력화하지 못하도록,
        // added 의 "의미 있는" 라인 수가 0 이면 added=0 으로 간주한다.
        if (delta < -20 && significantAddedCount(f.addedLines) === 0) {
          findings.push(
            makeFinding(
              RULE_ID,
              "high",
              `large test file shrink: -${f.deletedLines.length} lines`,
              { file: f.path }
            )
          );
        }
      }
    }
    return findings;
  }
};
