import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readHistory, appendHistory, getOverallTrend } from '../../src/scoring/history.js';
import type { ScoreResult } from '../../src/schema/score.js';

function makeScore(overrides: Partial<ScoreResult> = {}): ScoreResult {
  return {
    fragment_or_recipe: 'test-fragment',
    timestamp: new Date().toISOString(),
    metrics: [
      { name: 'clarity', value: 0.8, source: 'user' },
    ],
    overall: 0.8,
    ...overrides,
  };
}

describe('readHistory', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await mkdtemp(join(tmpdir(), 'aiwright-history-test-'));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('히스토리 파일이 없으면 빈 배열 반환', async () => {
    const result = await readHistory('nonexistent-fragment');
    expect(result).toEqual([]);
  });

  it('appendHistory 후 readHistory로 동일 데이터 반환', async () => {
    const score = makeScore({ overall: 0.75 });
    await appendHistory('my-fragment', score);

    const history = await readHistory('my-fragment');
    expect(history).toHaveLength(1);
    expect(history[0].overall).toBe(0.75);
    expect(history[0].fragment_or_recipe).toBe('test-fragment');
  });

  it('여러 번 appendHistory 시 순서대로 누적', async () => {
    await appendHistory('frag', makeScore({ overall: 0.5, timestamp: '2024-01-01T00:00:00.000Z' }));
    await appendHistory('frag', makeScore({ overall: 0.7, timestamp: '2024-01-02T00:00:00.000Z' }));
    await appendHistory('frag', makeScore({ overall: 0.9, timestamp: '2024-01-03T00:00:00.000Z' }));

    const history = await readHistory('frag');
    expect(history).toHaveLength(3);
    expect(history.map((h) => h.overall)).toEqual([0.5, 0.7, 0.9]);
  });

  it('다른 이름의 히스토리는 분리 저장', async () => {
    await appendHistory('frag-a', makeScore({ overall: 0.5 }));
    await appendHistory('frag-b', makeScore({ overall: 0.9 }));

    const historyA = await readHistory('frag-a');
    const historyB = await readHistory('frag-b');
    expect(historyA).toHaveLength(1);
    expect(historyB).toHaveLength(1);
    expect(historyA[0].overall).toBe(0.5);
    expect(historyB[0].overall).toBe(0.9);
  });
});

describe('getOverallTrend', () => {
  let originalCwd: string;
  let tmpDir: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await mkdtemp(join(tmpdir(), 'aiwright-trend-test-'));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('히스토리가 없으면 빈 배열 반환', async () => {
    const trend = await getOverallTrend('no-data');
    expect(trend).toEqual([]);
  });

  it('타임스탬프 오름차순으로 정렬된 overall 값 반환', async () => {
    // 역순으로 추가해도 오름차순 정렬되어야 함
    await appendHistory('frag', makeScore({ overall: 0.9, timestamp: '2024-03-01T00:00:00.000Z' }));
    await appendHistory('frag', makeScore({ overall: 0.5, timestamp: '2024-01-01T00:00:00.000Z' }));
    await appendHistory('frag', makeScore({ overall: 0.7, timestamp: '2024-02-01T00:00:00.000Z' }));

    const trend = await getOverallTrend('frag');
    expect(trend).toEqual([0.5, 0.7, 0.9]);
  });

  it('10개 초과 시 최신 10개만 반환', async () => {
    for (let i = 0; i < 15; i++) {
      const date = new Date(2024, 0, i + 1).toISOString();
      await appendHistory('frag', makeScore({ overall: i * 0.05, timestamp: date }));
    }

    const trend = await getOverallTrend('frag');
    expect(trend).toHaveLength(10);
    // 마지막 10개 (5~14번째, 즉 0.25 ~ 0.70)
    expect(trend[0]).toBeCloseTo(0.25, 5);
    expect(trend[9]).toBeCloseTo(0.7, 5);
  });

  it('정확히 10개면 전부 반환', async () => {
    for (let i = 0; i < 10; i++) {
      const date = new Date(2024, 0, i + 1).toISOString();
      await appendHistory('frag', makeScore({ overall: i * 0.1, timestamp: date }));
    }

    const trend = await getOverallTrend('frag');
    expect(trend).toHaveLength(10);
  });
});
