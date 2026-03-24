import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeCacheKey, readCache, writeCache, getCacheDir, type CacheEntry } from '../../src/intelligence/judge-cache.js';

// 테스트용 임시 캐시 디렉토리 (실제 ~/.aiwright/ 오염 방지)
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-cache-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeEntry(hash: string, overrides: Partial<CacheEntry> = {}): CacheEntry {
  return {
    hash,
    result: {
      score: 0.85,
      feedback: 'Good prompt.',
      strengths: ['Clear structure'],
      weaknesses: [],
      model: 'claude-haiku-4-5-20251001',
    },
    created_at: new Date().toISOString(),
    ttl_hours: 168,
    usage: { input_tokens: 500, output_tokens: 200 },
    ...overrides,
  };
}

// ─── computeCacheKey ──────────────────────────────────────────────────────────

describe('computeCacheKey', () => {
  it('같은 입력이면 같은 해시 반환', () => {
    const a = computeCacheKey('hello world', 'claude-haiku-4-5-20251001');
    const b = computeCacheKey('hello world', 'claude-haiku-4-5-20251001');
    expect(a).toBe(b);
  });

  it('다른 프롬프트 → 다른 해시', () => {
    const a = computeCacheKey('prompt A', 'claude-haiku-4-5-20251001');
    const b = computeCacheKey('prompt B', 'claude-haiku-4-5-20251001');
    expect(a).not.toBe(b);
  });

  it('다른 모델 → 다른 해시', () => {
    const a = computeCacheKey('same prompt', 'claude-haiku-4-5-20251001');
    const b = computeCacheKey('same prompt', 'gpt-4o-mini');
    expect(a).not.toBe(b);
  });

  it('SHA-256 hex: 64자', () => {
    const key = computeCacheKey('test', 'model');
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]+$/);
  });

  it('공백 정규화: 연속 공백 → 단일 공백', () => {
    const a = computeCacheKey('hello   world', 'model');
    const b = computeCacheKey('hello world', 'model');
    expect(a).toBe(b);
  });

  it('공백 정규화: \\r\\n → \\n 처리 후 동일 해시', () => {
    const a = computeCacheKey('line1\r\nline2', 'model');
    const b = computeCacheKey('line1\nline2', 'model');
    expect(a).toBe(b);
  });

  it('공백 정규화: 양쪽 trim', () => {
    const a = computeCacheKey('  hello  ', 'model');
    const b = computeCacheKey('hello', 'model');
    expect(a).toBe(b);
  });

  it('공백 정규화: 탭 → 단일 공백', () => {
    const a = computeCacheKey('a\t\tb', 'model');
    const b = computeCacheKey('a b', 'model');
    expect(a).toBe(b);
  });
});

// ─── writeCache / readCache 왕복 ──────────────────────────────────────────────

describe('writeCache → readCache 왕복', () => {
  it('저장 후 동일 항목 반환', async () => {
    const hash = computeCacheKey('test prompt', 'claude-haiku-4-5-20251001');
    const entry = makeEntry(hash);

    await writeCache(entry, tmpDir);
    const loaded = await readCache(hash, tmpDir);

    expect(loaded).not.toBeNull();
    expect(loaded!.hash).toBe(hash);
    expect(loaded!.result.score).toBe(0.85);
    expect(loaded!.result.strengths).toEqual(['Clear structure']);
    expect(loaded!.usage.input_tokens).toBe(500);
  });

  it('result 필드 전체 보존', async () => {
    const hash = computeCacheKey('full result test', 'gpt-4o-mini');
    const entry = makeEntry(hash, {
      result: {
        score: 0.72,
        feedback: 'Needs improvement.',
        strengths: ['s1', 's2'],
        weaknesses: ['w1'],
        model: 'gpt-4o-mini',
      },
    });

    await writeCache(entry, tmpDir);
    const loaded = await readCache(hash, tmpDir);

    expect(loaded!.result.feedback).toBe('Needs improvement.');
    expect(loaded!.result.weaknesses).toEqual(['w1']);
    expect(loaded!.result.model).toBe('gpt-4o-mini');
  });
});

// ─── TTL 만료 ─────────────────────────────────────────────────────────────────

describe('TTL 만료', () => {
  it('TTL 내 항목은 반환', async () => {
    const hash = computeCacheKey('valid ttl', 'model');
    const entry = makeEntry(hash, { ttl_hours: 168 }); // 7일

    await writeCache(entry, tmpDir);
    const loaded = await readCache(hash, tmpDir);

    expect(loaded).not.toBeNull();
  });

  it('만료된 created_at → null 반환', async () => {
    const hash = computeCacheKey('expired entry', 'model');
    const entry = makeEntry(hash, {
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2시간 전
      ttl_hours: 1,
    });

    await writeCache(entry, tmpDir);
    const loaded = await readCache(hash, tmpDir);

    expect(loaded).toBeNull();
  });

  it('만료 직전(1ms 남음)은 유효', async () => {
    const hash = computeCacheKey('near expiry', 'model');
    const entry = makeEntry(hash, {
      created_at: new Date(Date.now() - 59 * 60 * 1000).toISOString(), // 59분 전
      ttl_hours: 1, // 1시간 TTL → 1분 남음
    });

    await writeCache(entry, tmpDir);
    const loaded = await readCache(hash, tmpDir);

    expect(loaded).not.toBeNull();
  });
});

// ─── 파일 없음 ────────────────────────────────────────────────────────────────

describe('파일 없음', () => {
  it('존재하지 않는 해시 → null 반환', async () => {
    const result = await readCache('0'.repeat(64), tmpDir);
    expect(result).toBeNull();
  });
});

// ─── 캐시 디렉토리 자동 생성 ──────────────────────────────────────────────────

describe('캐시 디렉토리 자동 생성', () => {
  it('중첩 디렉토리가 없어도 writeCache 성공', async () => {
    const nestedDir = path.join(tmpDir, 'nested', 'deep');
    const hash = computeCacheKey('dir creation test', 'model');
    const entry = makeEntry(hash);

    // 디렉토리 없는 상태에서 writeCache 호출
    await expect(writeCache(entry, nestedDir)).resolves.not.toThrow();

    const loaded = await readCache(hash, nestedDir);
    expect(loaded).not.toBeNull();
  });

  it('getCacheDir()은 ~/.aiwright/judge-cache 반환', () => {
    const dir = getCacheDir();
    expect(dir).toBe(path.join(os.homedir(), '.aiwright', 'judge-cache'));
  });
});
