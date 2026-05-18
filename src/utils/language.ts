/**
 * 파일 확장자 기반 언어 감지 (Phase E).
 *
 * 본 모듈은 외부 IO 없는 순수 함수만 제공한다.
 */

export type Language =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "java"
  | "rust"
  | "unknown";

const EXT_MAP: ReadonlyArray<readonly [RegExp, Language]> = [
  [/\.(ts|tsx|mts|cts)$/i, "typescript"],
  [/\.(js|jsx|mjs|cjs)$/i, "javascript"],
  [/\.py$/i, "python"],
  [/\.go$/i, "go"],
  [/\.(java|kt|kts)$/i, "java"],
  [/\.rs$/i, "rust"]
];

export function detectLanguage(path: string): Language {
  for (const [re, lang] of EXT_MAP) {
    if (re.test(path)) return lang;
  }
  return "unknown";
}

export function detectPrimaryLanguage(
  paths: readonly string[]
): Language {
  const counts = new Map<Language, number>();
  for (const p of paths) {
    const lang = detectLanguage(p);
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  let max: Language = "unknown";
  let maxCount = 0;
  for (const [lang, c] of counts) {
    if (lang !== "unknown" && c > maxCount) {
      max = lang;
      maxCount = c;
    }
  }
  return max;
}

const CODE_FILE_RE =
  /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py|go|java|kt|kts|rs)$/i;

export function isCodeFile(path: string): boolean {
  return CODE_FILE_RE.test(path);
}
