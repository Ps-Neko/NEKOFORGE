/**
 * 파일시스템 기반 Artifact 구현. `.harness/` 하위에 쓰기·읽기.
 *
 * JSON 쓰기 시 schemaId 가 주어지면 검증한다. 실패하면 throw.
 */
import { mkdir, readFile, writeFile, appendFile, stat } from "node:fs/promises";
import { dirname, join, isAbsolute } from "node:path";
import { harnessRoot, withinHarness } from "../utils/paths.js";
import type { ArtifactReader, ArtifactWriter } from "./types.js";
import type { SchemaValidator } from "../schemas/loader.js";

export interface FsArtifactOptions {
  cwd?: string;
  validator?: SchemaValidator;
}

export class FsArtifact implements ArtifactReader, ArtifactWriter {
  private readonly root: string;
  private readonly cwd: string | undefined;
  private readonly validator: SchemaValidator | undefined;

  constructor(opts: FsArtifactOptions = {}) {
    this.cwd = opts.cwd;
    this.root = harnessRoot(opts.cwd);
    this.validator = opts.validator;
  }

  private resolve(relativePath: string): string {
    if (isAbsolute(relativePath)) {
      throw new Error(
        `artifact path must be relative to .harness/: ${relativePath}`
      );
    }
    const abs = join(this.root, relativePath);
    // `..` 정규화로 .harness/ 밖으로 탈출하는 것을 차단(B 감사 — withinHarness 연결).
    if (!withinHarness(abs, this.cwd)) {
      throw new Error(`artifact path escapes .harness/: ${relativePath}`);
    }
    return abs;
  }

  async writeMarkdown(relativePath: string, content: string): Promise<void> {
    const abs = this.resolve(relativePath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, "utf8");
  }

  async writeJson(
    relativePath: string,
    data: unknown,
    schemaId?: string
  ): Promise<void> {
    if (schemaId && this.validator) {
      const result = this.validator.validate(schemaId, data);
      if (!result.valid) {
        throw new Error(
          `artifact ${relativePath} fails schema "${schemaId}": ${result.errors.join("; ")}`
        );
      }
    }
    const abs = this.resolve(relativePath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, JSON.stringify(data, null, 2) + "\n", "utf8");
  }

  async appendJsonLines(relativePath: string, line: unknown): Promise<void> {
    const abs = this.resolve(relativePath);
    await mkdir(dirname(abs), { recursive: true });
    await appendFile(abs, JSON.stringify(line) + "\n", "utf8");
  }

  async readMarkdown(relativePath: string): Promise<string | null> {
    try {
      return await readFile(this.resolve(relativePath), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async readJson<T>(
    relativePath: string,
    schemaId?: string
  ): Promise<T | null> {
    const text = await this.readMarkdown(relativePath);
    if (text === null) return null;
    const parsed = JSON.parse(text) as T;
    if (schemaId && this.validator) {
      const r = this.validator.validate(schemaId, parsed);
      if (!r.valid) {
        throw new Error(
          `artifact ${relativePath} fails schema "${schemaId}": ${r.errors.join("; ")}`
        );
      }
    }
    return parsed;
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await stat(this.resolve(relativePath));
      return true;
    } catch {
      return false;
    }
  }
}
