import path from 'node:path';
import yaml from 'js-yaml';
import { ApplyManifest, ApplyManifestSchema, ApplyRecord } from '../schema/manifest.js';
import { fileExists, ensureDir, writeFileEnsure } from '../utils/fs.js';
import fs from 'node:fs/promises';

const MANIFEST_FILENAME = 'manifest.yaml';

function manifestPath(projectDir: string): string {
  return path.join(projectDir, '.aiwright', MANIFEST_FILENAME);
}

/**
 * manifest.yaml 읽기 (없으면 빈 manifest 반환)
 */
export async function readManifest(projectDir: string): Promise<ApplyManifest> {
  const filePath = manifestPath(projectDir);
  if (!(await fileExists(filePath))) {
    return { version: '1', history: [] };
  }

  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = yaml.load(raw);
  const result = ApplyManifestSchema.safeParse(parsed);

  if (!result.success) {
    // 손상된 manifest — 빈 것으로 초기화
    return { version: '1', history: [] };
  }

  return result.data;
}

/**
 * 적용 기록을 manifest에 append
 */
export async function appendManifest(
  projectDir: string,
  record: ApplyRecord,
): Promise<void> {
  const manifest = await readManifest(projectDir);
  manifest.history.push(record);
  await writeManifest(projectDir, manifest);
}

/**
 * manifest.yaml 쓰기
 */
export async function writeManifest(
  projectDir: string,
  manifest: ApplyManifest,
): Promise<void> {
  const filePath = manifestPath(projectDir);
  await ensureDir(path.dirname(filePath));
  const content = yaml.dump(manifest, { lineWidth: 120 });
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * 빈 manifest 파일 초기화
 */
export async function initManifest(projectDir: string): Promise<void> {
  const filePath = manifestPath(projectDir);
  if (await fileExists(filePath)) return;
  await writeManifest(projectDir, { version: '1', history: [] });
}
