import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printCompactSummary } from '../../src/intelligence/compact-summary.js';
import type { SummaryData } from '../../src/intelligence/compact-summary.js';
import type { ScoreBundle } from '../../src/intelligence/auto-score.js';
import type { LintResult } from '../../src/intelligence/linter.js';

function makeScore(overrides: Partial<ScoreBundle> = {}): ScoreBundle {
  return {
    heuristic: 0.75,
    judge: 0.85,
    final: 0.82,
    model: 'heuristic-sim-v1',
    tip: null,
    ...overrides,
  };
}

function makeData(overrides: Partial<SummaryData> = {}): SummaryData {
  return {
    recipeName: 'default',
    fragmentCount: 7,
    outputPaths: ['.claude/CLAUDE.md'],
    dnaCode: 'AW-S9E0I1',
    score: makeScore(),
    lintResults: [],
    weaknesses: [],
    quiet: false,
    ...overrides,
  };
}

describe('printCompactSummary', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('normal mode: outputs at least 2 lines', () => {
    printCompactSummary(makeData());
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
  });

  it('normal mode: first line contains recipe name and fragment count', () => {
    printCompactSummary(makeData({ recipeName: 'default', fragmentCount: 7 }));
    const firstCall = consoleLogSpy.mock.calls[0][0] as string;
    expect(firstCall).toContain('default');
    expect(firstCall).toContain('7');
  });

  it('normal mode: first line contains output path', () => {
    printCompactSummary(makeData({ outputPaths: ['.claude/CLAUDE.md'] }));
    const firstCall = consoleLogSpy.mock.calls[0][0] as string;
    expect(firstCall).toContain('.claude/CLAUDE.md');
  });

  it('normal mode: second line contains DNA code and score', () => {
    printCompactSummary(makeData({ dnaCode: 'AW-S9E0I1', score: makeScore({ final: 0.82 }) }));
    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('AW-S9E0I1');
    expect(allOutput).toContain('0.82');
  });

  it('normal mode: lint clean shows "clean"', () => {
    printCompactSummary(makeData({ lintResults: [] }));
    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('clean');
  });

  it('normal mode: HIGH lint result shows HIGH count', () => {
    const lintResults: LintResult[] = [
      { id: 'PS001', name: 'Missing Constraint', severity: 'HIGH', message: 'test' },
      { id: 'PS002', name: 'Too Short', severity: 'HIGH', message: 'test2' },
    ];
    printCompactSummary(makeData({ lintResults }));
    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('HIGH:2');
  });

  it('normal mode: tip shown when score.tip is set', () => {
    const score = makeScore({ tip: 'Add example slot to improve consistency' });
    printCompactSummary(makeData({ score }));
    expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    const thirdCall = consoleLogSpy.mock.calls[2][0] as string;
    expect(thirdCall).toContain('Add example slot to improve consistency');
  });

  it('normal mode: no tip line when score.tip is null', () => {
    const score = makeScore({ tip: null });
    printCompactSummary(makeData({ score }));
    expect(consoleLogSpy).toHaveBeenCalledTimes(2);
  });

  it('quiet mode: outputs exactly 1 line', () => {
    printCompactSummary(makeData({ quiet: true }));
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
  });

  it('quiet mode: output format is "[aiwright] recipe → score | DNA | lint"', () => {
    const data = makeData({
      quiet: true,
      recipeName: 'default',
      score: makeScore({ final: 0.82 }),
      dnaCode: 'AW-S9E0I1',
      lintResults: [],
    });
    printCompactSummary(data);
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('[aiwright]');
    expect(output).toContain('default');
    expect(output).toContain('0.82');
    expect(output).toContain('AW-S9E0I1');
    expect(output).toContain('clean');
  });

  it('quiet mode: WARN lint shows in output', () => {
    const lintResults: LintResult[] = [
      { id: 'PS002', name: 'Too Short', severity: 'WARN', message: 'test' },
    ];
    printCompactSummary(makeData({ quiet: true, lintResults }));
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(output).toContain('WARN:1');
  });
});
