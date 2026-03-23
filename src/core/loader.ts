import fs from 'node:fs/promises';
import matter from 'gray-matter';
import { FragmentFileSchema, FragmentFile } from '../schema/fragment.js';
import { InvalidFragmentError } from '../utils/errors.js';

/**
 * .md 파일 → FragmentFile (frontmatter + body)
 * gray-matter로 YAML frontmatter 분리 → Zod 검증
 */
export async function loadFragment(filePath: string): Promise<FragmentFile> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    throw new InvalidFragmentError(filePath, `Cannot read file: ${String(err)}`);
  }

  const parsed = matter(raw);
  const body = parsed.content.trim();

  if (!body) {
    throw new InvalidFragmentError(filePath, 'Fragment body is empty');
  }

  const result = FragmentFileSchema.safeParse({
    meta: parsed.data,
    body,
  });

  if (!result.success) {
    const details = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw new InvalidFragmentError(filePath, details);
  }

  return result.data;
}

/**
 * 여러 Fragment 파일 일괄 로드
 */
export async function loadFragments(filePaths: string[]): Promise<FragmentFile[]> {
  return Promise.all(filePaths.map(loadFragment));
}
