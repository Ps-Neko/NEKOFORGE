/**
 * Artifact = `.harness/` 하위에 저장되는 산출물.
 * 단계 모듈끼리는 본 인터페이스를 통해 통신한다 (ARCHITECTURE.md §5).
 */

export interface ArtifactWriter {
  writeMarkdown(relativePath: string, content: string): Promise<void>;
  writeJson(relativePath: string, data: unknown, schemaId?: string): Promise<void>;
  appendJsonLines(relativePath: string, line: unknown): Promise<void>;
}

export interface ArtifactReader {
  readMarkdown(relativePath: string): Promise<string | null>;
  readJson<T>(relativePath: string, schemaId?: string): Promise<T | null>;
  exists(relativePath: string): Promise<boolean>;
}
