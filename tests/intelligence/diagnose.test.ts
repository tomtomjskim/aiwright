import { describe, it, expect } from 'vitest';
import { diagnoseWeaknesses } from '../../src/intelligence/diagnose.js';
import type { PromptStyle } from '../../src/schema/user-profile.js';

function makeStyle(overrides: Partial<PromptStyle> = {}): PromptStyle {
  return {
    verbosity: 0.5,
    specificity: 0.7,
    context_ratio: 0.4,
    constraint_usage: 0.5,
    example_usage: 0.4,
    imperative_clarity: 0.5,
    ...overrides,
  };
}

describe('diagnoseWeaknesses — constraint_usage', () => {
  it('returns HIGH weakness when constraint_usage < 0.2', () => {
    const style = makeStyle({ constraint_usage: 0.1 });
    const weaknesses = diagnoseWeaknesses(style);
    // W001 corresponds to constraint_usage < 0.2
    const w = weaknesses.find((x) => x.id === 'W001');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('HIGH');
  });

  it('returns HIGH weakness at boundary constraint_usage = 0.0', () => {
    const style = makeStyle({ constraint_usage: 0.0 });
    const weaknesses = diagnoseWeaknesses(style);
    const w = weaknesses.find((x) => x.id === 'W001');
    expect(w?.severity).toBe('HIGH');
  });

  it('does NOT flag constraint_usage when value is >= 0.2', () => {
    const style = makeStyle({ constraint_usage: 0.2 });
    const weaknesses = diagnoseWeaknesses(style);
    const w = weaknesses.find((x) => x.id === 'W001');
    expect(w).toBeUndefined();
  });
});

describe('diagnoseWeaknesses — specificity', () => {
  it('returns HIGH weakness when specificity < 0.5', () => {
    const style = makeStyle({ specificity: 0.3 });
    const weaknesses = diagnoseWeaknesses(style);
    // W002 corresponds to specificity < 0.5
    const w = weaknesses.find((x) => x.id === 'W002');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('HIGH');
  });

  it('does NOT flag specificity when value is >= 0.5', () => {
    const style = makeStyle({ specificity: 0.5 });
    const weaknesses = diagnoseWeaknesses(style);
    const w = weaknesses.find((x) => x.id === 'W002');
    expect(w).toBeUndefined();
  });
});

describe('diagnoseWeaknesses — verbosity', () => {
  it('returns WARN weakness when verbosity < 0.15', () => {
    const style = makeStyle({ verbosity: 0.1 });
    const weaknesses = diagnoseWeaknesses(style);
    // W003 corresponds to verbosity < 0.15
    const w = weaknesses.find((x) => x.id === 'W003');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('WARN');
  });

  it('does NOT flag verbosity when value is >= 0.15', () => {
    const style = makeStyle({ verbosity: 0.15 });
    const weaknesses = diagnoseWeaknesses(style);
    const w = weaknesses.find((x) => x.id === 'W003');
    expect(w).toBeUndefined();
  });
});

describe('diagnoseWeaknesses — imperative_clarity', () => {
  it('returns WARN weakness when imperative_clarity < 0.3', () => {
    const style = makeStyle({ imperative_clarity: 0.2 });
    const weaknesses = diagnoseWeaknesses(style);
    // W005 corresponds to imperative_clarity < 0.3
    const w = weaknesses.find((x) => x.id === 'W005');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('WARN');
  });

  it('does NOT flag imperative_clarity when value is >= 0.3', () => {
    const style = makeStyle({ imperative_clarity: 0.3 });
    const weaknesses = diagnoseWeaknesses(style);
    const w = weaknesses.find((x) => x.id === 'W005');
    expect(w).toBeUndefined();
  });
});

describe('diagnoseWeaknesses — all good', () => {
  it('returns empty weaknesses array when all axes are within acceptable range', () => {
    const style = makeStyle({
      verbosity: 0.5,
      specificity: 0.7,
      context_ratio: 0.4,
      constraint_usage: 0.5,
      example_usage: 0.4,
      imperative_clarity: 0.5,
    });
    const weaknesses = diagnoseWeaknesses(style);
    expect(weaknesses).toEqual([]);
  });
});

describe('diagnoseWeaknesses — multiple weaknesses', () => {
  it('returns multiple weaknesses when several axes fail', () => {
    const style = makeStyle({
      constraint_usage: 0.05,  // W001 HIGH
      specificity: 0.2,        // W002 HIGH
      verbosity: 0.05,         // W003 WARN
      imperative_clarity: 0.1, // W005 WARN
    });
    const weaknesses = diagnoseWeaknesses(style);
    expect(weaknesses.length).toBeGreaterThanOrEqual(4);
  });

  it('each weakness has a non-empty message', () => {
    const style = makeStyle({ constraint_usage: 0.1, specificity: 0.3 });
    const weaknesses = diagnoseWeaknesses(style);
    for (const w of weaknesses) {
      expect(w.message.length).toBeGreaterThan(0);
    }
  });
});
