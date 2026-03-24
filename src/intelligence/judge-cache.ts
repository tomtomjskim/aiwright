/**
 * @module judge-cache
 * SHA-256 기반 LLM Judge 결과 캐시
 *
 * 캐시 디렉토리: ~/.aiwright/judge-cache/{hash[0:2]}/{hash}.yaml
 * TTL: created_at + ttl_hours > now 이면 유효
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';

export interface CacheEntry {
  hash: string;
  result: {
    score: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
    model: string;
  };
  created_at: string; // ISO 8601
  ttl_hours: number;  // 기본 168 (7일)
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * 프롬프트 텍스트와 모델명으로 캐시 키(SHA-256 hex) 계산
 *
 * 정규화:
 * - \r\n → \n
 * - 연속 공백 → 단일 공백
 * - 양쪽 trim
 * - suffix: model + 'v1' (스키마 버전)
 */
export function computeCacheKey(promptText: string, model: string): string {
  const normalized = promptText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return createHash('sha256').update(`${normalized}${model}v1`).digest('hex');
}

/**
 * 캐시 디렉토리 경로 반환
 */
export function getCacheDir(): string {
  return path.join(os.homedir(), '.aiwright', 'judge-cache');
}

/**
 * 캐시 파일 경로 계산 (샤딩: {dir}/{hash[0:2]}/{hash}.yaml)
 */
function getCacheFilePath(hash: string, cacheDir: string): string {
  return path.join(cacheDir, hash.slice(0, 2), `${hash}.yaml`);
}

/**
 * 캐시 항목이 TTL 내에 있는지 확인
 */
function isEntryValid(entry: CacheEntry): boolean {
  const createdAt = new Date(entry.created_at).getTime();
  const expiresAt = createdAt + entry.ttl_hours * 60 * 60 * 1000;
  return Date.now() < expiresAt;
}

/**
 * 캐시에서 항목 읽기
 *
 * @param hash - computeCacheKey()가 반환한 SHA-256 hex 문자열
 * @param cacheDir - 캐시 루트 디렉토리 (테스트 오버라이드용, 기본 getCacheDir())
 * @returns 유효한 CacheEntry, 없거나 만료 시 null
 */
export async function readCache(
  hash: string,
  cacheDir: string = getCacheDir(),
): Promise<CacheEntry | null> {
  const filePath = getCacheFilePath(hash, cacheDir);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const entry = yaml.load(raw) as CacheEntry;
    if (!isEntryValid(entry)) {
      return null;
    }
    return entry;
  } catch {
    // 파일 없음(ENOENT) 또는 파싱 오류 → null
    return null;
  }
}

/**
 * 캐시 항목 저장
 *
 * @param entry - 저장할 CacheEntry
 * @param cacheDir - 캐시 루트 디렉토리 (테스트 오버라이드용, 기본 getCacheDir())
 */
export async function writeCache(
  entry: CacheEntry,
  cacheDir: string = getCacheDir(),
): Promise<void> {
  const filePath = getCacheFilePath(entry.hash, cacheDir);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, yaml.dump(entry), 'utf-8');
}
