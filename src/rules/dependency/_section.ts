/**
 * dependency-risk pack 내부 공유 헬퍼 — package.json 섹션 경계 추적.
 *
 * 결정적 rule 은 diff 의 `addedLines` (= `+` 라인) 만 본다. `"dependencies": {`
 * 같은 섹션 헤더가 *추가* 되지 않은 경우(= context 라인)에는 헤더가 보이지 않으므로,
 * 본 추적기는 "헤더를 본 적 없음 = unknown" 상태를 dependency 섹션일 *수도* 있는 것으로
 * 관대하게 취급해 기존 true-positive 를 보존한다. 명시적으로 비-dependency 섹션
 * 헤더(scripts/publishConfig/engines 등)가 추가로 보였을 때만 그 안쪽 라인을 제외해
 * false-positive(예: version bump / publishConfig 메타필드 / tool-config prepare)를 줄인다.
 *
 * 이 헬퍼는 dependency 패밀리 내부 전용이며 다른 패밀리/공용 파일을 건드리지 않는다.
 */

export type PkgSection = "deps" | "non-deps" | "unknown";

/** dependency 류 섹션 헤더 (런타임/dev/peer/optional/bundle). */
const DEPS_HEADER_RE =
  /^\s*"(?:dependencies|devDependencies|peerDependencies|optionalDependencies|bundleDependencies|bundledDependencies)"\s*:\s*\{/;

/**
 * 명시적 비-dependency object 섹션 헤더. 이 안쪽 라인은 dep 으로 보지 않는다.
 * (scripts 는 postinstall rule 이 별도로 쓰므로 여기서 함께 추적.)
 */
const NON_DEPS_HEADER_RE =
  /^\s*"(?:scripts|publishConfig|engines|engineStrict|overrides|resolutions|pnpm|workspaces|exports|imports|config|browserslist|peerDependenciesMeta|husky|lint-staged|release-it|nyc|jest|eslintConfig|prettier|commitlint|volta|packageManager)"\s*:/;

/** object 섹션의 닫힘 `}` (들여쓰기 2~4칸의 단독 닫힘 추정). */
const SECTION_CLOSE_RE = /^\s{0,6}\},?\s*$/;

/**
 * 한 파일의 addedLines 를 순회하며 각 라인의 섹션 상태를 계산한다.
 * 반환 배열은 addedLines 와 1:1 대응.
 *
 * 규칙:
 *  - dependency 헤더를 만나면 그 헤더 라인 *이후* 가 "deps".
 *  - 비-dependency 헤더를 만나면 이후가 "non-deps".
 *  - 섹션 닫힘 `}` 을 만나면 "unknown" 으로 복귀(다음 헤더 전까지 보수적).
 *  - 헤더를 본 적 없으면 "unknown" (헤더가 context 라인일 수 있으므로).
 */
export function sectionStates(addedLines: readonly string[]): PkgSection[] {
  const states: PkgSection[] = [];
  let current: PkgSection = "unknown";
  for (const line of addedLines) {
    if (DEPS_HEADER_RE.test(line)) {
      // 헤더 라인 자체는 dep 라인이 아니므로 헤더 직전 상태로 기록.
      states.push(current);
      current = "deps";
      continue;
    }
    if (NON_DEPS_HEADER_RE.test(line)) {
      states.push(current);
      current = "non-deps";
      continue;
    }
    if (SECTION_CLOSE_RE.test(line) && current !== "unknown") {
      // 섹션 종료 — 보수적으로 unknown 복귀.
      states.push(current);
      current = "unknown";
      continue;
    }
    states.push(current);
  }
  return states;
}

/** 해당 라인 상태가 dependency 섹션일 *수 있는가* (deps | unknown). */
export function inDepsSection(state: PkgSection): boolean {
  return state === "deps" || state === "unknown";
}

/**
 * npm lifecycle script 판정용 세분 상태.
 *  - "scripts": package.json 의 `"scripts"` object 안.
 *  - "tool-config": husky/release-it/lint-staged 등 도구 설정 object 안 — 여기의
 *    `prepare` 등은 npm lifecycle 이 아니므로 발화하면 안 된다(FP).
 *  - "unknown": 헤더 미관측(헤더가 context 라인일 수 있음) — 보수적으로 발화 허용.
 */
export type ScriptScope = "scripts" | "tool-config" | "unknown";

const SCRIPTS_HEADER_RE = /^\s*"scripts"\s*:\s*\{/;
/** npm lifecycle 이 아닌 도구 설정 object 헤더(이 안의 prepare 류는 무시). */
const TOOL_CONFIG_HEADER_RE =
  /^\s*"(?:husky|release-it|lint-staged|simple-git-hooks|pre-commit|nano-staged|commitlint|standard-version|np|semantic-release)"\s*:\s*\{?/;

export function scriptScopeStates(addedLines: readonly string[]): ScriptScope[] {
  const states: ScriptScope[] = [];
  let current: ScriptScope = "unknown";
  for (const line of addedLines) {
    if (SCRIPTS_HEADER_RE.test(line)) {
      states.push(current);
      current = "scripts";
      continue;
    }
    if (TOOL_CONFIG_HEADER_RE.test(line)) {
      states.push(current);
      current = "tool-config";
      continue;
    }
    if (SECTION_CLOSE_RE.test(line) && current !== "unknown") {
      states.push(current);
      current = "unknown";
      continue;
    }
    states.push(current);
  }
  return states;
}
