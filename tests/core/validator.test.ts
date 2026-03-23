import { describe, it, expect } from 'vitest';
import { validateRecipe, assertValid } from '../../src/core/validator.js';
import type { FragmentFile } from '../../src/schema/fragment.js';
import type { Recipe } from '../../src/schema/recipe.js';
import { CyclicDependencyError, FragmentConflictError } from '../../src/utils/errors.js';

function makeFragment(
  name: string,
  overrides: Partial<FragmentFile['meta']> = {}
): FragmentFile {
  return {
    meta: {
      name,
      version: '0.1.0',
      description: `Fragment ${name}`,
      tags: [],
      model_hint: [],
      slot: 'instruction',
      priority: 50,
      depends_on: [],
      conflicts_with: [],
      variables: {},
      ...overrides,
    },
    body: `Body of ${name}`,
  };
}

function makeRecipe(
  fragmentNames: string[],
  options: Partial<{ vars: Record<string, unknown> }> = {}
): Recipe {
  return {
    name: 'test-recipe',
    description: 'Test recipe',
    adapter: 'generic',
    fragments: fragmentNames.map((name) => ({ fragment: name, enabled: true })),
    vars: options.vars ?? {},
  };
}

describe('validateRecipe — normal flow', () => {
  it('returns valid=true for a recipe with no conflicts or cycles', () => {
    const fragments = [makeFragment('frag-a'), makeFragment('frag-b')];
    const recipe = makeRecipe(['frag-a', 'frag-b']);
    const result = validateRecipe(recipe, fragments);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns empty warnings for fragments with no dependency issues', () => {
    const fragments = [makeFragment('frag-a')];
    const recipe = makeRecipe(['frag-a']);
    const result = validateRecipe(recipe, fragments);
    expect(result.warnings).toHaveLength(0);
  });

  it('skips disabled fragments during validation', () => {
    const fragA = makeFragment('frag-a', { conflicts_with: ['frag-b'] });
    const fragB = makeFragment('frag-b');
    const recipe = {
      ...makeRecipe(['frag-a', 'frag-b']),
      fragments: [
        { fragment: 'frag-a', enabled: true },
        { fragment: 'frag-b', enabled: false },
      ],
    };
    const result = validateRecipe(recipe, [fragA, fragB]);
    expect(result.valid).toBe(true);
  });
});

describe('validateRecipe — conflicts_with detection', () => {
  it('detects conflict when both conflicting fragments are in recipe', () => {
    const fragA = makeFragment('frag-a', { conflicts_with: ['frag-b'] });
    const fragB = makeFragment('frag-b');
    const recipe = makeRecipe(['frag-a', 'frag-b']);
    const result = validateRecipe(recipe, [fragA, fragB]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('conflict');
    expect(result.errors[0].message).toContain('frag-a');
    expect(result.errors[0].message).toContain('frag-b');
  });

  it('does not flag conflict when conflicting fragment is not in recipe', () => {
    const fragA = makeFragment('frag-a', { conflicts_with: ['absent-frag'] });
    const recipe = makeRecipe(['frag-a']);
    const result = validateRecipe(recipe, [fragA]);
    expect(result.valid).toBe(true);
  });
});

describe('validateRecipe — cyclic dependency detection', () => {
  it('detects a direct cycle: A depends on B, B depends on A', () => {
    const fragA = makeFragment('frag-a', { depends_on: ['frag-b'] });
    const fragB = makeFragment('frag-b', { depends_on: ['frag-a'] });
    const recipe = makeRecipe(['frag-a', 'frag-b']);
    const result = validateRecipe(recipe, [fragA, fragB]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('cycle');
  });

  it('detects a three-node cycle: A → B → C → A', () => {
    const fragA = makeFragment('frag-a', { depends_on: ['frag-b'] });
    const fragB = makeFragment('frag-b', { depends_on: ['frag-c'] });
    const fragC = makeFragment('frag-c', { depends_on: ['frag-a'] });
    const recipe = makeRecipe(['frag-a', 'frag-b', 'frag-c']);
    const result = validateRecipe(recipe, [fragA, fragB, fragC]);
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('cycle');
  });

  it('passes a valid DAG with no cycles: A → B → C', () => {
    const fragA = makeFragment('frag-a', { depends_on: ['frag-b'] });
    const fragB = makeFragment('frag-b', { depends_on: ['frag-c'] });
    const fragC = makeFragment('frag-c');
    const recipe = makeRecipe(['frag-a', 'frag-b', 'frag-c']);
    const result = validateRecipe(recipe, [fragA, fragB, fragC]);
    expect(result.valid).toBe(true);
  });

  it('warns about unknown dependency not in the recipe', () => {
    const fragA = makeFragment('frag-a', { depends_on: ['missing-dep'] });
    const recipe = makeRecipe(['frag-a']);
    const result = validateRecipe(recipe, [fragA]);
    expect(result.warnings.some((w) => w.type === 'unknown_dep')).toBe(true);
  });
});

describe('validateRecipe — missing required variable warnings', () => {
  it('warns when required variable has no default or provided value', () => {
    const fragA = makeFragment('frag-a', {
      variables: {
        myVar: { type: 'string', required: true, default: undefined, description: undefined },
      },
    });
    const recipe = makeRecipe(['frag-a']);
    const result = validateRecipe(recipe, [fragA]);
    expect(result.warnings.some((w) => w.type === 'missing_var')).toBe(true);
  });

  it('does not warn when required variable has a default value', () => {
    const fragA = makeFragment('frag-a', {
      variables: {
        myVar: { type: 'string', required: true, default: 'defaultVal', description: undefined },
      },
    });
    const recipe = makeRecipe(['frag-a']);
    const result = validateRecipe(recipe, [fragA]);
    expect(result.warnings.filter((w) => w.type === 'missing_var')).toHaveLength(0);
  });

  it('does not warn when required variable is provided via recipe vars', () => {
    const fragA = makeFragment('frag-a', {
      variables: {
        myVar: { type: 'string', required: true, default: undefined, description: undefined },
      },
    });
    const recipe = makeRecipe(['frag-a'], { vars: { myVar: 'supplied' } });
    const result = validateRecipe(recipe, [fragA]);
    expect(result.warnings.filter((w) => w.type === 'missing_var')).toHaveLength(0);
  });
});

describe('assertValid', () => {
  it('does not throw for a valid result', () => {
    const result = { valid: true, errors: [], warnings: [] };
    expect(() => assertValid(result)).not.toThrow();
  });

  it('throws CyclicDependencyError for cycle error', () => {
    const result = {
      valid: false,
      errors: [{ type: 'cycle' as const, message: 'Cyclic dependency detected among: frag-a, frag-b' }],
      warnings: [],
    };
    expect(() => assertValid(result)).toThrow(CyclicDependencyError);
  });

  it('throws FragmentConflictError for conflict error', () => {
    const result = {
      valid: false,
      errors: [{ type: 'conflict' as const, message: 'Fragment "frag-a" conflicts with "frag-b"' }],
      warnings: [],
    };
    expect(() => assertValid(result)).toThrow(FragmentConflictError);
  });
});
