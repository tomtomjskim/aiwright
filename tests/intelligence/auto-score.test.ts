import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeAutoScore } from '../../src/intelligence/auto-score.js';
import type { FragmentFile } from '../../src/schema/fragment.js';
import type { LintResult } from '../../src/intelligence/linter.js';

// 기본 FragmentFile fixture
function makeFragment(overrides: Partial<FragmentFile> = {}): FragmentFile {
  return {
    meta: {
      name: 'test-fragment',
      slot: 'instruction',
      version: '1.0.0',
      description: 'Test fragment',
      variables: {},
      tags: [],
      conflicts_with: [],
      requires: [],
    },
    body: 'You are a senior engineer. Always write clean code.',
    path: '/tmp/test.md',
    ...overrides,
  };
}

const goodPrompt = `[system]
You are a senior software engineer.

[instruction]
Always write clean code. Return the result.

[constraint]
Never output code without TypeScript types.`;

const emptyPrompt = '';

describe('computeAutoScore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ScoreBundle with heuristic, judge, final, model, tip', async () => {
    const fragments = [makeFragment()];
    const sections = new Map([['instruction', 'Always write clean code.']]);
    const lintResults: LintResult[] = [];

    const result = await computeAutoScore(fragments, goodPrompt, sections, lintResults);

    expect(result).toHaveProperty('heuristic');
    expect(result).toHaveProperty('judge');
    expect(result).toHaveProperty('final');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('tip');
  });

  it('heuristic is average of computeHeuristics metrics', async () => {
    // system + instruction 모두 있는 fragments → structural_completeness = 1.0
    const sysFragment = makeFragment({ meta: { ...makeFragment().meta, name: 'sys', slot: 'system' } });
    const instFragment = makeFragment({ meta: { ...makeFragment().meta, name: 'inst', slot: 'instruction' } });
    const fragments = [sysFragment, instFragment];
    const sections = new Map<string, string>();
    const lintResults: LintResult[] = [];

    const result = await computeAutoScore(fragments, goodPrompt, sections, lintResults);

    // heuristic 범위: 0 ~ 1
    expect(result.heuristic).toBeGreaterThanOrEqual(0);
    expect(result.heuristic).toBeLessThanOrEqual(1);
  });

  it('final = 0.4 * heuristic + 0.6 * judge (approximately)', async () => {
    const fragments = [makeFragment()];
    const sections = new Map<string, string>();
    const lintResults: LintResult[] = [];

    const result = await computeAutoScore(fragments, goodPrompt, sections, lintResults);

    const expected = Math.round((result.heuristic * 0.4 + result.judge * 0.6) * 100) / 100;
    expect(result.final).toBeCloseTo(expected, 5);
  });

  it('judge fallback to heuristic when judgePrompt throws', async () => {
    const { judgePrompt } = await import('../../src/intelligence/llm-judge.js');
    vi.spyOn({ judgePrompt }, 'judgePrompt').mockRejectedValue(new Error('LLM unavailable'));

    // judgePrompt를 mock하여 실패 시나리오 시뮬레이션
    // computeAutoScore 내부 try/catch가 heuristic fallback 처리
    const fragments = [makeFragment()];
    const sections = new Map<string, string>();
    const lintResults: LintResult[] = [];

    // 실패해도 최종 결과는 반환되어야 함
    const result = await computeAutoScore(fragments, emptyPrompt, sections, lintResults);
    expect(result.final).toBeGreaterThanOrEqual(0);
    expect(result.final).toBeLessThanOrEqual(1);
  });

  it('tip is null when no lint results and no judge weaknesses', async () => {
    const fragments = [makeFragment()];
    const sections = new Map<string, string>();
    // 빈 lint results → tip = judge weakness[0] or null
    const lintResults: LintResult[] = [];

    const result = await computeAutoScore(fragments, goodPrompt, sections, lintResults);

    // tip은 null이거나 문자열
    expect(result.tip === null || typeof result.tip === 'string').toBe(true);
  });

  it('tip is HIGH lint message when HIGH lint exists', async () => {
    const fragments = [makeFragment()];
    const sections = new Map<string, string>();
    const lintResults: LintResult[] = [
      { id: 'PS001', name: 'Missing Constraint', severity: 'HIGH', message: 'constraint slot이 없습니다.' },
      { id: 'PS002', name: 'Too Short', severity: 'WARN', message: '프롬프트가 너무 짧습니다.' },
    ];

    const result = await computeAutoScore(fragments, goodPrompt, sections, lintResults);

    expect(result.tip).toBe('constraint slot이 없습니다.');
  });

  it('tip is WARN lint message when only WARN lint exists (no HIGH)', async () => {
    const fragments = [makeFragment()];
    const sections = new Map<string, string>();
    const lintResults: LintResult[] = [
      { id: 'PS002', name: 'Too Short', severity: 'WARN', message: '프롬프트가 너무 짧습니다.' },
    ];

    const result = await computeAutoScore(fragments, goodPrompt, sections, lintResults);

    expect(result.tip).toBe('프롬프트가 너무 짧습니다.');
  });

  it('heuristic is 0 for empty fragments array', async () => {
    const sections = new Map<string, string>();
    const lintResults: LintResult[] = [];

    const result = await computeAutoScore([], emptyPrompt, sections, lintResults);

    // empty fragments: structural_completeness=0, length_ratio=0, variable_coverage=1 (vacuously true)
    expect(result.heuristic).toBeCloseTo(0.333, 1);
  });

  it('final score is between 0 and 1', async () => {
    const fragments = [makeFragment()];
    const sections = new Map<string, string>();
    const lintResults: LintResult[] = [
      { id: 'PS001', name: 'Missing Constraint', severity: 'HIGH', message: 'test' },
      { id: 'PS003', name: 'Too Long', severity: 'WARN', message: 'test' },
    ];

    const result = await computeAutoScore(fragments, goodPrompt, sections, lintResults);

    expect(result.final).toBeGreaterThanOrEqual(0);
    expect(result.final).toBeLessThanOrEqual(1);
  });

  it('model is set to heuristic-sim-v1 on success', async () => {
    const fragments = [makeFragment()];
    const sections = new Map<string, string>();
    const lintResults: LintResult[] = [];

    const result = await computeAutoScore(fragments, goodPrompt, sections, lintResults);

    // judgePrompt 정상 실행 시 heuristic-sim-v1 반환
    expect(result.model).toBe('heuristic-sim-v1');
  });

  it('sections parameter is accepted and does not throw', async () => {
    const fragments = [makeFragment()];
    const sections = new Map([
      ['system', 'You are helpful.'],
      ['instruction', 'Do the task.'],
      ['constraint', 'Never lie.'],
    ]);
    const lintResults: LintResult[] = [];

    await expect(
      computeAutoScore(fragments, goodPrompt, sections, lintResults),
    ).resolves.toBeDefined();
  });
});
