import { describe, it, expect } from 'vitest';
import { MetricValueSchema, ScoreResultSchema, ScoreFileSchema } from '../../src/schema/score.js';

describe('MetricValueSchema', () => {
  const validMetric = {
    name: 'structural_completeness',
    value: 0.8,
    source: 'heuristic' as const,
  };

  it('parses a valid metric value', () => {
    const result = MetricValueSchema.parse(validMetric);
    expect(result.name).toBe('structural_completeness');
    expect(result.value).toBe(0.8);
    expect(result.source).toBe('heuristic');
  });

  it('accepts source values: user, heuristic, llm-judge', () => {
    for (const source of ['user', 'heuristic', 'llm-judge'] as const) {
      const result = MetricValueSchema.parse({ ...validMetric, source });
      expect(result.source).toBe(source);
    }
  });

  it('accepts optional rationale field', () => {
    const result = MetricValueSchema.parse({ ...validMetric, rationale: 'Good coverage' });
    expect(result.rationale).toBe('Good coverage');
  });

  it('fails when value is below 0', () => {
    expect(() => MetricValueSchema.parse({ ...validMetric, value: -0.1 })).toThrow();
  });

  it('fails when value is above 1', () => {
    expect(() => MetricValueSchema.parse({ ...validMetric, value: 1.1 })).toThrow();
  });

  it('accepts boundary values 0 and 1', () => {
    expect(MetricValueSchema.parse({ ...validMetric, value: 0 }).value).toBe(0);
    expect(MetricValueSchema.parse({ ...validMetric, value: 1 }).value).toBe(1);
  });

  it('fails with invalid source', () => {
    expect(() => MetricValueSchema.parse({ ...validMetric, source: 'unknown' })).toThrow();
  });
});

describe('ScoreResultSchema', () => {
  const validScore = {
    fragment_or_recipe: 'my-fragment',
    timestamp: '2024-01-01T00:00:00.000Z',
    metrics: [
      { name: 'structural_completeness', value: 1.0, source: 'heuristic' as const },
    ],
    overall: 0.9,
  };

  it('parses a valid score result', () => {
    const result = ScoreResultSchema.parse(validScore);
    expect(result.fragment_or_recipe).toBe('my-fragment');
    expect(result.overall).toBe(0.9);
    expect(result.metrics).toHaveLength(1);
  });

  it('accepts optional diagnosis, model, adapter fields', () => {
    const result = ScoreResultSchema.parse({
      ...validScore,
      diagnosis: 'Looks good',
      model: 'claude-3',
      adapter: 'claude-code',
    });
    expect(result.diagnosis).toBe('Looks good');
    expect(result.model).toBe('claude-3');
    expect(result.adapter).toBe('claude-code');
  });

  it('fails when timestamp is not datetime', () => {
    expect(() => ScoreResultSchema.parse({ ...validScore, timestamp: 'bad-date' })).toThrow();
  });

  it('fails when overall is out of range', () => {
    expect(() => ScoreResultSchema.parse({ ...validScore, overall: 1.5 })).toThrow();
    expect(() => ScoreResultSchema.parse({ ...validScore, overall: -0.1 })).toThrow();
  });
});

describe('ScoreFileSchema', () => {
  it('parses an array of score results', () => {
    const record = {
      fragment_or_recipe: 'r',
      timestamp: '2024-01-01T00:00:00.000Z',
      metrics: [],
      overall: 0.5,
    };
    const result = ScoreFileSchema.parse([record, record]);
    expect(result).toHaveLength(2);
  });

  it('parses empty array', () => {
    expect(ScoreFileSchema.parse([])).toEqual([]);
  });
});
