import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

/** 경로 존재 여부 확인 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** 디렉터리 재귀 생성 (이미 있어도 OK) */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/** 파일 안전하게 읽기 (없으면 null) */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/** 텍스트 파일 쓰기 (중간 디렉터리 자동 생성) */
export async function writeFileEnsure(
  filePath: string,
  content: string,
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf-8');
}

/** 디렉터리 안의 파일 목록 반환 (확장자 필터 선택) */
export async function listFiles(
  dirPath: string,
  ext?: string,
): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && (ext == null || e.name.endsWith(ext)))
      .map((e) => path.join(dirPath, e.name));
  } catch {
    return [];
  }
}

/** YAML 파일 파싱 (unknown 반환) */
export async function readYaml(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8');
  return yaml.load(content);
}

/** 객체를 YAML 문자열로 직렬화하여 파일에 기록 */
export async function writeYaml(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const content = yaml.dump(data, { lineWidth: 120 });
  await fs.writeFile(filePath, content, 'utf-8');
}
