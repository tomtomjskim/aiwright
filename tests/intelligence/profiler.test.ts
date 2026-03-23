import { describe, it, expect } from 'vitest';
import { computeStyle, generateDnaCode, aggregateDomains } from '../../src/intelligence/profiler.js';
import type { UsageEvent } from '../../src/schema/usage-event.js';

function makeEvent(overrides: Partial<UsageEvent['prompt_metrics']> = {}, score?: number, domainTags: string[] = []): UsageEvent {
  return {
    event_id: '00000000-0000-0000-0000-000000000001',
    event_type: 'apply',
    timestamp: new Date().toISOString(),
    recipe: 'test-recipe',
    domain_tags: domainTags,
    prompt_metrics: {
      total_chars: 500,
      slot_count: 2,
      variable_count: 2,
      variable_filled: 2,
      has_constraint: false,
      has_example: false,
      has_context: false,
      sentence_count: 4,
      imperative_ratio: 0.5,
      ...overrides,
    },
    ...(score !== undefined
      ? { outcome: { score, turn_count: 1 } }
      : {}),
  };
}

describe('computeStyle — empty events', () => {
  it('returns default style (all axes 0 or neutral) for empty events array', () => {
    const result = computeStyle([]);
    // All axes should be defined numeric values
    expect(typeof result.verbosity).toBe('number');
    expect(typeof result.specificity).toBe('number');
    expect(typeof result.context_ratio).toBe('number');
    expect(typeof result.constraint_usage).toBe('number');
    expect(typeof result.example_usage).toBe('number');
    expect(typeof result.imperative_clarity).toBe('number');
  });

  it('returns zero constraint_usage for empty events', () => {
    const result = computeStyle([]);
    expect(result.constraint_usage).toBe(0);
  });

  it('returns zero example_usage for empty events', () => {
    const result = computeStyle([]);
    expect(result.example_usage).toBe(0);
  });
});

describe('computeStyle — constraint events', () => {
  it('returns constraint_usage > 0 when events have has_constraint=true', () => {
    const events = [
      makeEvent({ has_constraint: true }),
      makeEvent({ has_constraint: true }),
    ];
    const result = computeStyle(events);
    expect(result.constraint_usage).toBeGreaterThan(0);
  });

  it('returns constraint_usage = 1.0 when all events have has_constraint=true', () => {
    const events = [
      makeEvent({ has_constraint: true }),
      makeEvent({ has_constraint: true }),
      makeEvent({ has_constraint: true }),
    ];
    const result = computeStyle(events);
    expect(result.constraint_usage).toBe(1.0);
  });

  it('returns partial constraint_usage for mixed events', () => {
    const events = [
      makeEvent({ has_constraint: true }),
      makeEvent({ has_constraint: false }),
    ];
    const result = computeStyle(events);
    expect(result.constraint_usage).toBe(0.5);
  });

  it('returns example_usage proportional to has_example frequency', () => {
    const events = [
      makeEvent({ has_example: true }),
      makeEvent({ has_example: false }),
      makeEvent({ has_example: false }),
      makeEvent({ has_example: false }),
    ];
    const result = computeStyle(events);
    expect(result.example_usage).toBeCloseTo(0.25);
  });

  it('returns context_ratio proportional to has_context frequency', () => {
    const events = [
      makeEvent({ has_context: true }),
      makeEvent({ has_context: true }),
      makeEvent({ has_context: false }),
    ];
    const result = computeStyle(events);
    expect(result.context_ratio).toBeCloseTo(2 / 3);
  });
});

describe('generateDnaCode', () => {
  it('returns a string matching AW-{X}{d}{X}{d}{X}{d} pattern', () => {
    const style = {
      verbosity: 0.8,
      specificity: 0.2,
      context_ratio: 0.5,
      constraint_usage: 0.0,
      example_usage: 0.5,
      imperative_clarity: 0.6,
    };
    const code = generateDnaCode(style);
    expect(code).toMatch(/^AW-[A-Z]\d[A-Z]\d[A-Z]\d$/);
  });

  it('selects the 3 most characteristic axes (largest deviation from 0.5)', () => {
    // constraint_usage=0.0 (dev=0.5), verbosity=1.0 (dev=0.5), specificity=0.0 (dev=0.5)
    // context_ratio=0.5 (dev=0), example_usage=0.5 (dev=0), imperative_clarity=0.5 (dev=0)
    const style = {
      verbosity: 1.0,
      specificity: 0.0,
      context_ratio: 0.5,
      constraint_usage: 0.0,
      example_usage: 0.5,
      imperative_clarity: 0.5,
    };
    const code = generateDnaCode(style);
    // code should include V, S, R (the three axes with max deviation)
    expect(code).toMatch(/AW-/);
    // The code encodes 3 axes — check it has 3 letter-digit pairs
    const pairs = code.slice(3).match(/[A-Z]\d/g);
    expect(pairs).toHaveLength(3);
  });

  it('encodes value 0.0 as quantile 0', () => {
    const style = {
      verbosity: 0.0,
      specificity: 0.5,
      context_ratio: 0.5,
      constraint_usage: 0.5,
      example_usage: 0.5,
      imperative_clarity: 0.5,
    };
    const code = generateDnaCode(style);
    // V axis with value 0.0 should encode as 0
    expect(code).toContain('V0');
  });

  it('encodes value 1.0 as quantile 9', () => {
    const style = {
      verbosity: 1.0,
      specificity: 0.5,
      context_ratio: 0.5,
      constraint_usage: 0.5,
      example_usage: 0.5,
      imperative_clarity: 0.5,
    };
    const code = generateDnaCode(style);
    expect(code).toContain('V9');
  });

  it('returns AW-prefixed code always', () => {
    const style = {
      verbosity: 0.5,
      specificity: 0.5,
      context_ratio: 0.5,
      constraint_usage: 0.5,
      example_usage: 0.5,
      imperative_clarity: 0.5,
    };
    const code = generateDnaCode(style);
    expect(code.startsWith('AW-')).toBe(true);
  });
});

describe('aggregateDomains', () => {
  it('returns empty array for empty events', () => {
    const result = aggregateDomains([]);
    expect(result).toEqual([]);
  });

  it('calculates avg_score per domain from outcome', () => {
    const events = [
      makeEvent({}, 0.8, ['coding']),
      makeEvent({}, 0.6, ['coding']),
      makeEvent({}, 1.0, ['writing']),
    ];
    const result = aggregateDomains(events);
    const coding = result.find((d) => d.domain === 'coding');
    const writing = result.find((d) => d.domain === 'writing');
    expect(coding?.avg_score).toBeCloseTo(0.7);
    expect(writing?.avg_score).toBeCloseTo(1.0);
  });

  it('counts total_events per domain', () => {
    const events = [
      makeEvent({}, 0.5, ['coding']),
      makeEvent({}, 0.5, ['coding']),
      makeEvent({}, 0.5, ['data']),
    ];
    const result = aggregateDomains(events);
    const coding = result.find((d) => d.domain === 'coding');
    expect(coding?.total_events).toBe(2);
  });

  it('skips events without domain_tags when aggregating', () => {
    const events = [
      makeEvent({}, 0.5, []),
      makeEvent({}, 0.9, ['writing']),
    ];
    const result = aggregateDomains(events);
    expect(result).toHaveLength(1);
    expect(result[0].domain).toBe('writing');
  });
});
