import { describe, it, expect } from 'vitest';
import { optimizeCombination } from '../../src/intelligence/optimizer.js';
import type { FragmentFile } from '../../src/schema/fragment.js';

// ---- helpers ----

function makeFragment(
  name: string,
  slot: FragmentFile['meta']['slot'],
  body: string,
  conflictsWith: string[] = [],
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
      conflicts_with: conflictsWith,
      variables: {},
    },
    body,
  };
}

// system + instruction → structural_completeness = 1.0, length_ratio, variable_coverage = 1.0
const SYSTEM_FRAGMENT = makeFragment('sys', 'system', 'You are a helpful assistant.');
const INSTRUCTION_FRAGMENT = makeFragment('inst', 'instruction', 'Complete the task accurately.');
const CONSTRAINT_FRAGMENT = makeFragment('constraint-a', 'constraint', 'Never produce harmful content.');
const OUTPUT_FRAGMENT = makeFragment('output-md', 'output', 'Return markdown formatted output.');
const OUTPUT_JSON_FRAGMENT = makeFragment('output-json', 'output', 'Return JSON formatted output.', ['output-md']);
const EXTRA_FRAGMENT = makeFragment('extra', 'context', 'Extra context here.');

// ---- tests ----

describe('optimizeCombination — empty fragments list', () => {
  it('returns baseline score 0 when no fragments provided', () => {
    const result = optimizeCombination([], {
      available_fragments: [],
      current_recipe_fragments: [],
    });
    expect(result.best_score).toBe(0);
    expect(result.best_combination).toEqual([]);
  });

  it('returns improvement 0 when both baseline and best are 0', () => {
    const result = optimizeCombination([], {
      available_fragments: [],
      current_recipe_fragments: [],
    });
    expect(result.improvement).toBe(0);
  });
});

describe('optimizeCombination — single fragment', () => {
  it('returns the single fragment as best combination', () => {
    const fragments = [SYSTEM_FRAGMENT];
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys'],
      current_recipe_fragments: ['sys'],
    });
    expect(result.best_combination).toContain('sys');
  });

  it('has at least 1 history entry (baseline)', () => {
    const fragments = [SYSTEM_FRAGMENT];
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys'],
      current_recipe_fragments: ['sys'],
    });
    expect(result.history.length).toBeGreaterThanOrEqual(1);
  });
});

describe('optimizeCombination — conflicts_with enforcement', () => {
  it('never selects conflicting fragments together', () => {
    const fragments = [SYSTEM_FRAGMENT, INSTRUCTION_FRAGMENT, OUTPUT_FRAGMENT, OUTPUT_JSON_FRAGMENT];
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys', 'inst', 'output-md', 'output-json'],
      current_recipe_fragments: ['sys', 'inst', 'output-md'],
      max_iterations: 20,
    });
    const hasOutputMd = result.best_combination.includes('output-md');
    const hasOutputJson = result.best_combination.includes('output-json');
    // output-json conflicts_with output-md — must not coexist
    expect(hasOutputMd && hasOutputJson).toBe(false);
  });

  it('can select output-json when output-md is not in combination', () => {
    const fragments = [SYSTEM_FRAGMENT, OUTPUT_JSON_FRAGMENT];
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys', 'output-json'],
      current_recipe_fragments: ['sys'],
      max_iterations: 10,
    });
    // output-json alone has no conflict
    const hasConflict =
      result.best_combination.includes('output-md') &&
      result.best_combination.includes('output-json');
    expect(hasConflict).toBe(false);
  });
});

describe('optimizeCombination — score improvement tracking', () => {
  it('records improvement in history when better combination found', () => {
    // sys alone = structural_completeness 0.5, adding inst brings it to 1.0
    const fragments = [SYSTEM_FRAGMENT, INSTRUCTION_FRAGMENT];
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys', 'inst'],
      current_recipe_fragments: ['sys'],
      max_iterations: 20,
    });
    // Best score should include both sys + inst → structural_completeness = 1.0
    expect(result.best_score).toBeGreaterThanOrEqual(result.history[0].score);
  });

  it('best_score is always >= baseline score', () => {
    const fragments = [SYSTEM_FRAGMENT, INSTRUCTION_FRAGMENT, CONSTRAINT_FRAGMENT];
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys', 'inst', 'constraint-a'],
      current_recipe_fragments: ['sys'],
      max_iterations: 20,
    });
    const baseline = result.history[0].score;
    expect(result.best_score).toBeGreaterThanOrEqual(baseline);
  });

  it('improvement is positive when best_score > baseline', () => {
    const fragments = [SYSTEM_FRAGMENT, INSTRUCTION_FRAGMENT];
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys', 'inst'],
      current_recipe_fragments: ['sys'],
      max_iterations: 20,
    });
    if (result.best_score > result.history[0].score) {
      expect(result.improvement).toBeGreaterThan(0);
    }
  });
});

describe('optimizeCombination — max_iterations', () => {
  it('terminates within max_iterations when provided', () => {
    const fragments = [SYSTEM_FRAGMENT, INSTRUCTION_FRAGMENT, CONSTRAINT_FRAGMENT, EXTRA_FRAGMENT];
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys', 'inst', 'constraint-a', 'extra'],
      current_recipe_fragments: ['sys', 'inst'],
      max_iterations: 5,
    });
    expect(result.iterations).toBeLessThanOrEqual(5);
  });

  it('uses default 20 iterations when not specified', () => {
    const fragments = [SYSTEM_FRAGMENT, INSTRUCTION_FRAGMENT];
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys', 'inst'],
      current_recipe_fragments: ['sys'],
    });
    expect(result.iterations).toBeLessThanOrEqual(20);
  });

  it('terminates early after 3 consecutive non-improvements', () => {
    // All fragments have equal score potential — no room for improvement
    const fragments = [CONSTRAINT_FRAGMENT]; // only constraint slot, no system/instruction
    const result = optimizeCombination(fragments, {
      available_fragments: ['constraint-a'],
      current_recipe_fragments: ['constraint-a'],
      max_iterations: 20,
    });
    // Should terminate early because no mutations are possible with single fragment that's already selected
    expect(result.iterations).toBeLessThan(20);
  });
});

describe('optimizeCombination — available_fragments filtering', () => {
  it('only considers fragments in available_fragments list', () => {
    const fragments = [SYSTEM_FRAGMENT, INSTRUCTION_FRAGMENT, EXTRA_FRAGMENT];
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys', 'inst'], // extra not available
      current_recipe_fragments: ['sys'],
      max_iterations: 20,
    });
    expect(result.best_combination).not.toContain('extra');
  });

  it('ignores available_fragments names that have no matching FragmentFile', () => {
    const fragments = [SYSTEM_FRAGMENT];
    // 'nonexistent' is in available but not in fragments array
    const result = optimizeCombination(fragments, {
      available_fragments: ['sys', 'nonexistent'],
      current_recipe_fragments: ['sys'],
      max_iterations: 5,
    });
    expect(result.best_combination).not.toContain('nonexistent');
  });
});

describe('optimizeCombination — return shape', () => {
  it('result has all required fields', () => {
    const result = optimizeCombination([SYSTEM_FRAGMENT], {
      available_fragments: ['sys'],
      current_recipe_fragments: ['sys'],
    });
    expect(result).toHaveProperty('best_combination');
    expect(result).toHaveProperty('best_score');
    expect(result).toHaveProperty('iterations');
    expect(result).toHaveProperty('history');
    expect(result).toHaveProperty('improvement');
  });

  it('history entries each have combination and score', () => {
    const result = optimizeCombination([SYSTEM_FRAGMENT, INSTRUCTION_FRAGMENT], {
      available_fragments: ['sys', 'inst'],
      current_recipe_fragments: ['sys'],
    });
    for (const entry of result.history) {
      expect(entry).toHaveProperty('combination');
      expect(entry).toHaveProperty('score');
      expect(Array.isArray(entry.combination)).toBe(true);
      expect(typeof entry.score).toBe('number');
    }
  });
});
