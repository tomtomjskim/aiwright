import { describe, it, expect } from 'vitest';
import { computeHeuristics } from '../../src/scoring/heuristic.js';
import type { FragmentFile } from '../../src/schema/fragment.js';

function makeFragment(
  name: string,
  slot: FragmentFile['meta']['slot'],
  body: string,
  variables: FragmentFile['meta']['variables'] = {}
): FragmentFile {
  return {
    meta: {
      name,
      version: '0.1.0',
      description: `Fragment ${name}`,
      tags: [],
      model_hint: [],
      slot,
      priority: 50,
      depends_on: [],
      conflicts_with: [],
      variables,
    },
    body,
  };
}

describe('computeHeuristics', () => {
  it('returns exactly 3 metrics', () => {
    const metrics = computeHeuristics([makeFragment('f', 'instruction', 'Body')]);
    expect(metrics).toHaveLength(3);
  });

  it('all metrics have source=heuristic', () => {
    const metrics = computeHeuristics([makeFragment('f', 'instruction', 'Body')]);
    for (const m of metrics) {
      expect(m.source).toBe('heuristic');
    }
  });
});

describe('structural_completeness heuristic', () => {
  it('returns 1.0 when both system and instruction slots are present', () => {
    const fragments = [
      makeFragment('sys', 'system', 'System body'),
      makeFragment('inst', 'instruction', 'Instruction body'),
    ];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'structural_completeness')!;
    expect(metric.value).toBe(1.0);
  });

  it('returns 0.5 when only system slot is present', () => {
    const fragments = [makeFragment('sys', 'system', 'System body')];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'structural_completeness')!;
    expect(metric.value).toBe(0.5);
  });

  it('returns 0.5 when only instruction slot is present', () => {
    const fragments = [makeFragment('inst', 'instruction', 'Instruction body')];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'structural_completeness')!;
    expect(metric.value).toBe(0.5);
  });

  it('returns 0.0 when neither system nor instruction is present', () => {
    const fragments = [
      makeFragment('const', 'constraint', 'Constraint body'),
      makeFragment('out', 'output', 'Output body'),
    ];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'structural_completeness')!;
    expect(metric.value).toBe(0.0);
  });

  it('returns 0.0 when fragments list is empty', () => {
    const metrics = computeHeuristics([]);
    const metric = metrics.find((m) => m.name === 'structural_completeness')!;
    expect(metric.value).toBe(0.0);
  });
});

describe('length_ratio heuristic', () => {
  it('returns 1.0 when total body length >= 2000 characters', () => {
    const longBody = 'A'.repeat(2000);
    const fragments = [makeFragment('f', 'instruction', longBody)];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'length_ratio')!;
    expect(metric.value).toBe(1.0);
  });

  it('returns 0.5 for 1000 characters', () => {
    const body = 'A'.repeat(1000);
    const fragments = [makeFragment('f', 'instruction', body)];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'length_ratio')!;
    expect(metric.value).toBe(0.5);
  });

  it('returns 0.0 for empty fragments list', () => {
    const metrics = computeHeuristics([]);
    const metric = metrics.find((m) => m.name === 'length_ratio')!;
    expect(metric.value).toBe(0.0);
  });

  it('sums body lengths across multiple fragments', () => {
    const fragments = [
      makeFragment('a', 'system', 'A'.repeat(1000)),
      makeFragment('b', 'instruction', 'B'.repeat(1000)),
    ];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'length_ratio')!;
    expect(metric.value).toBe(1.0);
  });

  it('caps at 1.0 for length exceeding 2000', () => {
    const longBody = 'X'.repeat(5000);
    const fragments = [makeFragment('f', 'instruction', longBody)];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'length_ratio')!;
    expect(metric.value).toBe(1.0);
  });
});

describe('variable_coverage heuristic', () => {
  it('returns 1.0 when no variables are declared (vacuously true)', () => {
    const fragments = [makeFragment('f', 'instruction', 'No variables here.')];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'variable_coverage')!;
    expect(metric.value).toBe(1.0);
  });

  it('returns 1.0 when all declared variables are used in body', () => {
    const variables: FragmentFile['meta']['variables'] = {
      name: { type: 'string', required: false, default: undefined, description: undefined },
      role: { type: 'string', required: false, default: undefined, description: undefined },
    };
    const fragments = [makeFragment('f', 'instruction', 'Hello {{name}}, you are a {{role}}.', variables)];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'variable_coverage')!;
    expect(metric.value).toBe(1.0);
  });

  it('returns 0.5 when only half of declared variables are used', () => {
    const variables: FragmentFile['meta']['variables'] = {
      used: { type: 'string', required: false, default: undefined, description: undefined },
      unused: { type: 'string', required: false, default: undefined, description: undefined },
    };
    const fragments = [makeFragment('f', 'instruction', 'Only {{used}} is here.', variables)];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'variable_coverage')!;
    expect(metric.value).toBe(0.5);
  });

  it('returns 0.0 when no declared variables are used in body', () => {
    const variables: FragmentFile['meta']['variables'] = {
      unused1: { type: 'string', required: false, default: undefined, description: undefined },
      unused2: { type: 'string', required: false, default: undefined, description: undefined },
    };
    const fragments = [makeFragment('f', 'instruction', 'No variables used at all.', variables)];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'variable_coverage')!;
    expect(metric.value).toBe(0.0);
  });

  it('aggregates variable coverage across multiple fragments', () => {
    const vars1: FragmentFile['meta']['variables'] = {
      v1: { type: 'string', required: false, default: undefined, description: undefined },
    };
    const vars2: FragmentFile['meta']['variables'] = {
      v2: { type: 'string', required: false, default: undefined, description: undefined },
    };
    const fragments = [
      makeFragment('a', 'system', '{{v1}} here.', vars1),
      makeFragment('b', 'instruction', 'No vars used.', vars2),
    ];
    const metrics = computeHeuristics(fragments);
    const metric = metrics.find((m) => m.name === 'variable_coverage')!;
    // 1 used out of 2 declared
    expect(metric.value).toBe(0.5);
  });
});
