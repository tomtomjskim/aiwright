import { describe, it, expect } from 'vitest';
import {
  PromptMetricsSchema,
  OutcomeMetricsSchema,
  UsageEventSchema,
} from '../../src/schema/usage-event.js';

describe('PromptMetricsSchema', () => {
  const validMetrics = {
    total_chars: 500,
    slot_count: 3,
    variable_count: 2,
    variable_filled: 2,
    has_constraint: true,
    has_example: false,
    has_context: true,
    sentence_count: 5,
    imperative_ratio: 0.4,
  };

  it('parses valid prompt metrics data', () => {
    const result = PromptMetricsSchema.parse(validMetrics);
    expect(result.total_chars).toBe(500);
    expect(result.slot_count).toBe(3);
    expect(result.variable_count).toBe(2);
    expect(result.variable_filled).toBe(2);
    expect(result.has_constraint).toBe(true);
    expect(result.imperative_ratio).toBe(0.4);
  });

  it('fails when total_chars is negative', () => {
    expect(() => PromptMetricsSchema.parse({ ...validMetrics, total_chars: -1 })).toThrow();
  });

  it('accepts variable_filled equal to variable_count', () => {
    const result = PromptMetricsSchema.parse({ ...validMetrics, variable_count: 2, variable_filled: 2 });
    expect(result.variable_filled).toBe(2);
  });

  it('accepts zero slot_count (empty prompt)', () => {
    const result = PromptMetricsSchema.parse({ ...validMetrics, slot_count: 0 });
    expect(result.slot_count).toBe(0);
  });

  it('fails when imperative_ratio exceeds 1.0', () => {
    expect(() => PromptMetricsSchema.parse({ ...validMetrics, imperative_ratio: 1.5 })).toThrow();
  });
});

describe('OutcomeMetricsSchema', () => {
  it('parses valid outcome metrics', () => {
    const result = OutcomeMetricsSchema.parse({ score: 0.85, turn_count: 2 });
    expect(result.score).toBe(0.85);
    expect(result.turn_count).toBe(2);
  });

  it('accepts score at boundary 0.0', () => {
    const result = OutcomeMetricsSchema.parse({ score: 0.0, turn_count: 1 });
    expect(result.score).toBe(0.0);
  });

  it('accepts score at boundary 1.0', () => {
    const result = OutcomeMetricsSchema.parse({ score: 1.0, turn_count: 1 });
    expect(result.score).toBe(1.0);
  });

  it('fails when score exceeds 1.0', () => {
    expect(() => OutcomeMetricsSchema.parse({ score: 1.1, turn_count: 1 })).toThrow();
  });

  it('fails when score is negative', () => {
    expect(() => OutcomeMetricsSchema.parse({ score: -0.1, turn_count: 1 })).toThrow();
  });

  it('accepts turn_count of zero', () => {
    const result = OutcomeMetricsSchema.parse({ score: 0.5, turn_count: 0 });
    expect(result.turn_count).toBe(0);
  });
});

describe('UsageEventSchema', () => {
  const validPromptMetrics = {
    total_chars: 300,
    slot_count: 2,
    variable_count: 1,
    variable_filled: 1,
    has_constraint: false,
    has_example: false,
    has_context: false,
    sentence_count: 3,
    imperative_ratio: 0.3,
  };

  const validEvent = {
    event_id: '00000000-0000-0000-0000-000000000001',
    event_type: 'apply' as const,
    timestamp: '2026-03-23T10:00:00.000Z',
    recipe: 'my-recipe',
    prompt_metrics: validPromptMetrics,
  };

  it('parses a valid usage event', () => {
    const result = UsageEventSchema.parse(validEvent);
    expect(result.event_type).toBe('apply');
    expect(result.prompt_metrics.total_chars).toBe(300);
  });

  it('accepts event_type: apply', () => {
    expect(UsageEventSchema.parse({ ...validEvent, event_type: 'apply' }).event_type).toBe('apply');
  });

  it('accepts event_type: score', () => {
    expect(UsageEventSchema.parse({ ...validEvent, event_type: 'score' }).event_type).toBe('score');
  });

  it('accepts event_type: bench', () => {
    expect(UsageEventSchema.parse({ ...validEvent, event_type: 'bench' }).event_type).toBe('bench');
  });

  it('fails on unknown event_type', () => {
    expect(() => UsageEventSchema.parse({ ...validEvent, event_type: 'unknown' })).toThrow();
  });

  it('fails when prompt_metrics is missing', () => {
    const { prompt_metrics: _, ...noMetrics } = validEvent;
    expect(() => UsageEventSchema.parse(noMetrics)).toThrow();
  });

  it('accepts optional outcome', () => {
    const withOutcome = {
      ...validEvent,
      outcome: { score: 0.9, turn_count: 1 },
    };
    const result = UsageEventSchema.parse(withOutcome);
    expect(result.outcome?.score).toBe(0.9);
  });

  it('parses without outcome (optional)', () => {
    const result = UsageEventSchema.parse(validEvent);
    expect(result.outcome).toBeUndefined();
  });
});
