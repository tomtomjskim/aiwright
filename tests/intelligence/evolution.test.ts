import { describe, it, expect } from 'vitest';
import { evolveFragments } from '../../src/intelligence/evolution.js';
import type { FragmentFile } from '../../src/schema/fragment.js';
import type { PromptStyle, Weakness } from '../../src/schema/user-profile.js';

// ---- helpers ----

function makeFragment(
  name: string,
  slot: FragmentFile['meta']['slot'],
  body: string,
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
      variables: {},
    },
    body,
  };
}

function makeStyle(overrides: Partial<PromptStyle> = {}): PromptStyle {
  return {
    verbosity: 0.5,
    specificity: 0.7,
    context_ratio: 0.4,
    constraint_usage: 0.5,
    example_usage: 0.5,
    imperative_clarity: 0.6,
    ...overrides,
  };
}

function makeWeakness(id: string, severity: 'HIGH' | 'WARN' | 'INFO' = 'WARN'): Weakness {
  return {
    id,
    severity,
    message: `Weakness ${id}`,
    suggestion: `Fix ${id}`,
  };
}

// ---- tests ----

describe('evolveFragments — no weaknesses', () => {
  it('returns empty evolved_fragments when style is all good and no weaknesses', () => {
    const fragments = [makeFragment('sys', 'system', 'Always write clean code.')];
    const style = makeStyle(); // all axes healthy
    const result = evolveFragments(fragments, style, []);
    // With no weaknesses and all axes above thresholds, no improvements needed
    // (imperative_clarity=0.6 passes, constraint=0.5 passes, example=0.5 passes, specificity=0.7 passes)
    expect(result.evolved_fragments).toHaveLength(0);
  });

  it('still returns strategy_evolution even with no weaknesses', () => {
    const fragments = [makeFragment('sys', 'system', 'Always write clean code.')];
    const style = makeStyle();
    const result = evolveFragments(fragments, style, []);
    expect(result.strategy_evolution).toBeDefined();
    expect(result.strategy_evolution.current).toBeTruthy();
    expect(result.strategy_evolution.suggested).toBeTruthy();
  });
});

describe('evolveFragments — make_imperative suggestion', () => {
  it('suggests make_imperative when imperative_clarity < 0.3', () => {
    const fragments = [
      makeFragment('sys', 'system', 'You write clean code.\nYou should follow conventions.'),
    ];
    const style = makeStyle({ imperative_clarity: 0.1 });
    const weaknesses = [makeWeakness('W005', 'WARN')];

    const result = evolveFragments(fragments, style, weaknesses);
    const imp = result.evolved_fragments.find((e) => e.improvement_type === 'make_imperative');
    expect(imp).toBeDefined();
    expect(imp?.original).toBe('sys');
    expect(imp?.suggestion).toBeTruthy();
  });

  it('make_imperative suggestion transforms "You write" → "Always write"', () => {
    const fragments = [makeFragment('sys', 'system', 'You write clean code.')];
    const style = makeStyle({ imperative_clarity: 0.1 });
    const weaknesses = [makeWeakness('W005')];

    const result = evolveFragments(fragments, style, weaknesses);
    const imp = result.evolved_fragments.find((e) => e.improvement_type === 'make_imperative');
    expect(imp?.suggestion).toMatch(/Always/i);
  });

  it('triggers make_imperative via W005 weakness id regardless of style value', () => {
    const fragments = [makeFragment('inst', 'instruction', 'You should follow conventions.')];
    // Style axis is borderline but W005 is present
    const style = makeStyle({ imperative_clarity: 0.29 });
    const weaknesses = [makeWeakness('W005')];

    const result = evolveFragments(fragments, style, weaknesses);
    const imp = result.evolved_fragments.find((e) => e.improvement_type === 'make_imperative');
    expect(imp).toBeDefined();
  });
});

describe('evolveFragments — add_example suggestion', () => {
  it('suggests add_example when example_usage === 0', () => {
    const fragments = [makeFragment('inst', 'instruction', 'Complete the assigned task carefully.')];
    // example_usage = 0, but imperative and constraint are fine so make_imperative/strengthen won't trigger
    const style = makeStyle({
      example_usage: 0,
      imperative_clarity: 0.6,
      constraint_usage: 0.6,
      specificity: 0.8,
    });
    const weaknesses = [makeWeakness('W004', 'INFO')];

    const result = evolveFragments(fragments, style, weaknesses);
    const addEx = result.evolved_fragments.find((e) => e.improvement_type === 'add_example');
    expect(addEx).toBeDefined();
    expect(addEx?.original).toBe('inst');
    expect(addEx?.suggestion).toMatch(/Example/i);
  });

  it('add_example suggestion contains "Input" and "Output" markers', () => {
    const fragments = [makeFragment('inst', 'instruction', 'Do something.')];
    const style = makeStyle({ example_usage: 0, imperative_clarity: 0.6, constraint_usage: 0.6, specificity: 0.8 });
    const weaknesses = [makeWeakness('W004')];

    const result = evolveFragments(fragments, style, weaknesses);
    const addEx = result.evolved_fragments.find((e) => e.improvement_type === 'add_example');
    expect(addEx?.suggestion).toMatch(/Input/);
    expect(addEx?.suggestion).toMatch(/Output/);
  });
});

describe('evolveFragments — strengthen suggestion', () => {
  it('suggests strengthen when constraint_usage < 0.2', () => {
    const fragments = [makeFragment('inst', 'instruction', 'Complete the task.')];
    const style = makeStyle({
      constraint_usage: 0.1,
      imperative_clarity: 0.6,
      specificity: 0.8,
      example_usage: 0.5,
    });
    const weaknesses = [makeWeakness('W001', 'HIGH')];

    const result = evolveFragments(fragments, style, weaknesses);
    const strengthen = result.evolved_fragments.find((e) => e.improvement_type === 'strengthen');
    expect(strengthen).toBeDefined();
    expect(strengthen?.suggestion).toMatch(/Never/i);
  });
});

describe('evolveFragments — strategy_evolution', () => {
  it('strategy_evolution.current describes the dominant style', () => {
    const fragments = [makeFragment('sys', 'system', 'Always be helpful.')];
    const style = makeStyle({
      constraint_usage: 0.8,
      example_usage: 0.7,
      imperative_clarity: 0.7,
    });
    const result = evolveFragments(fragments, style, []);
    expect(result.strategy_evolution.current).toBeTruthy();
    expect(typeof result.strategy_evolution.current).toBe('string');
  });

  it('strategy_evolution.suggested mentions the weakest axis', () => {
    const fragments = [makeFragment('sys', 'system', 'Always be helpful.')];
    // constraint_usage is the lowest
    const style = makeStyle({
      constraint_usage: 0.05,
      imperative_clarity: 0.6,
      example_usage: 0.6,
      specificity: 0.8,
      verbosity: 0.5,
      context_ratio: 0.4,
    });
    const weaknesses = [makeWeakness('W001', 'HIGH')];
    const result = evolveFragments(fragments, style, weaknesses);
    expect(result.strategy_evolution.suggested).toMatch(/constraint_usage/i);
  });

  it('strategy_evolution exists for all fragment inputs', () => {
    const fragments = [
      makeFragment('sys', 'system', 'You are an assistant.'),
      makeFragment('inst', 'instruction', 'Do the task.'),
    ];
    const style = makeStyle({ imperative_clarity: 0.1 });
    const weaknesses = [makeWeakness('W005')];
    const result = evolveFragments(fragments, style, weaknesses);
    expect(result.strategy_evolution).toHaveProperty('current');
    expect(result.strategy_evolution).toHaveProperty('suggested');
  });
});

describe('evolveFragments — empty fragments', () => {
  it('returns empty evolved_fragments for empty fragment list', () => {
    const style = makeStyle({ imperative_clarity: 0.1 });
    const weaknesses = [makeWeakness('W005')];
    const result = evolveFragments([], style, weaknesses);
    expect(result.evolved_fragments).toHaveLength(0);
  });

  it('still returns strategy_evolution for empty fragment list', () => {
    const style = makeStyle({ constraint_usage: 0.05 });
    const result = evolveFragments([], style, [makeWeakness('W001')]);
    expect(result.strategy_evolution).toBeDefined();
    expect(result.strategy_evolution.suggested).toBeTruthy();
  });
});

describe('evolveFragments — result shape', () => {
  it('each evolved fragment has original, suggestion, and improvement_type', () => {
    const fragments = [makeFragment('sys', 'system', 'You write clean code.')];
    const style = makeStyle({ imperative_clarity: 0.1 });
    const weaknesses = [makeWeakness('W005')];
    const result = evolveFragments(fragments, style, weaknesses);
    for (const evo of result.evolved_fragments) {
      expect(evo).toHaveProperty('original');
      expect(evo).toHaveProperty('suggestion');
      expect(evo).toHaveProperty('improvement_type');
      expect(['strengthen', 'clarify', 'add_example', 'make_imperative']).toContain(
        evo.improvement_type,
      );
    }
  });

  it('improvement_type is one of the four valid types', () => {
    const validTypes = ['strengthen', 'clarify', 'add_example', 'make_imperative'];
    const fragments = [
      makeFragment('a', 'system', 'You write code.'),
      makeFragment('b', 'instruction', 'Do the task with {{topic}}.'),
    ];
    const style = makeStyle({ imperative_clarity: 0.1, specificity: 0.3 });
    const weaknesses = [makeWeakness('W005'), makeWeakness('W002')];
    const result = evolveFragments(fragments, style, weaknesses);
    for (const evo of result.evolved_fragments) {
      expect(validTypes).toContain(evo.improvement_type);
    }
  });
});
