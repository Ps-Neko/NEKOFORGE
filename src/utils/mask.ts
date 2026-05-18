/**
 * secret 으로 보이는 토큰을 출력에서 가린다 (SECURITY.md §8).
 *
 * 휴리스틱:
 * - 24자 이상의 영숫자·-·_ 연속.
 * - 단, JSON null 토큰("null", "true", "false")이나 파일 경로 추정은 제외.
 */

const TOKEN_RE = /[A-Za-z0-9_-]{24,}/g;
const EXCLUDE = new Set(["null", "true", "false", "undefined"]);

export function maskSecrets(input: string): string {
  return input.replace(TOKEN_RE, (m) => {
    if (EXCLUDE.has(m.toLowerCase())) return m;
    const head = m.slice(0, 4);
    return `${head}${"*".repeat(Math.max(8, m.length - 4))}`;
  });
}

export function looksLikeSecret(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 8) return false;
  if (EXCLUDE.has(trimmed.toLowerCase())) return false;
  return /^[A-Za-z0-9_\-+/=]+$/.test(trimmed) || /-----BEGIN /.test(trimmed);
}
