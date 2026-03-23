import { describe, it, expect } from 'vitest';
import { RecipeSchema, RecipeEntrySchema } from '../../src/schema/recipe.js';

describe('RecipeEntrySchema', () => {
  it('parses a minimal recipe entry', () => {
    const result = RecipeEntrySchema.parse({ fragment: 'my-fragment' });
    expect(result.fragment).toBe('my-fragment');
    expect(result.enabled).toBe(true);
  });

  it('applies default enabled=true', () => {
    const result = RecipeEntrySchema.parse({ fragment: 'test' });
    expect(result.enabled).toBe(true);
  });

  it('accepts disabled entry', () => {
    const result = RecipeEntrySchema.parse({ fragment: 'test', enabled: false });
    expect(result.enabled).toBe(false);
  });

  it('accepts vars object', () => {
    const result = RecipeEntrySchema.parse({ fragment: 'test', vars: { key: 'value', num: 42 } });
    expect(result.vars).toEqual({ key: 'value', num: 42 });
  });

  it('fails when fragment is empty string', () => {
    expect(() => RecipeEntrySchema.parse({ fragment: '' })).toThrow();
  });

  it('fails when fragment is missing', () => {
    expect(() => RecipeEntrySchema.parse({})).toThrow();
  });
});

describe('RecipeSchema', () => {
  const validRecipe = {
    name: 'my-recipe',
    description: 'A test recipe',
    fragments: [{ fragment: 'fragment-one' }],
  };

  it('parses a minimal valid recipe', () => {
    const result = RecipeSchema.parse(validRecipe);
    expect(result.name).toBe('my-recipe');
    expect(result.description).toBe('A test recipe');
    expect(result.fragments).toHaveLength(1);
  });

  it('applies default adapter=generic', () => {
    const result = RecipeSchema.parse(validRecipe);
    expect(result.adapter).toBe('generic');
  });

  it('applies default vars={}', () => {
    const result = RecipeSchema.parse(validRecipe);
    expect(result.vars).toEqual({});
  });

  it('fails when name contains uppercase', () => {
    expect(() => RecipeSchema.parse({ ...validRecipe, name: 'MyRecipe' })).toThrow();
  });

  it('fails when name is empty', () => {
    expect(() => RecipeSchema.parse({ ...validRecipe, name: '' })).toThrow();
  });

  it('fails when fragments array is empty', () => {
    expect(() => RecipeSchema.parse({ ...validRecipe, fragments: [] })).toThrow();
  });

  it('fails when description is missing', () => {
    const { description: _, ...noDesc } = validRecipe;
    expect(() => RecipeSchema.parse(noDesc)).toThrow();
  });

  it('accepts custom adapter value', () => {
    const result = RecipeSchema.parse({ ...validRecipe, adapter: 'claude-code' });
    expect(result.adapter).toBe('claude-code');
  });

  it('accepts multiple fragments', () => {
    const result = RecipeSchema.parse({
      ...validRecipe,
      fragments: [
        { fragment: 'frag-one' },
        { fragment: 'frag-two', enabled: false },
        { fragment: 'frag-three', vars: { x: 1 } },
      ],
    });
    expect(result.fragments).toHaveLength(3);
  });
});
