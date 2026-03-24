import { describe, it, expect } from 'vitest';
import { ProjectConfigSchema, JudgeConfigSchema } from '../../src/schema/config.js';

describe('ProjectConfigSchema', () => {
  const validConfig = {
    version: '1' as const,
  };

  it('parses a minimal valid config', () => {
    const result = ProjectConfigSchema.parse(validConfig);
    expect(result.version).toBe('1');
  });

  it('applies default adapter=claude-code', () => {
    const result = ProjectConfigSchema.parse(validConfig);
    expect(result.adapter).toBe('claude-code');
  });

  it('applies default vars={}', () => {
    const result = ProjectConfigSchema.parse(validConfig);
    expect(result.vars).toEqual({});
  });

  it('applies default paths.local=.aiwright/fragments', () => {
    const result = ProjectConfigSchema.parse(validConfig);
    expect(result.paths.local).toBe('.aiwright/fragments');
  });

  it('applies default recipes={}', () => {
    const result = ProjectConfigSchema.parse(validConfig);
    expect(result.recipes).toEqual({});
  });

  it('fails when version is not "1"', () => {
    expect(() => ProjectConfigSchema.parse({ version: '2' })).toThrow();
  });

  it('fails when version is missing', () => {
    expect(() => ProjectConfigSchema.parse({})).toThrow();
  });

  it('accepts custom adapter', () => {
    const result = ProjectConfigSchema.parse({ ...validConfig, adapter: 'generic' });
    expect(result.adapter).toBe('generic');
  });

  it('accepts custom vars', () => {
    const result = ProjectConfigSchema.parse({ ...validConfig, vars: { myVar: 'hello', count: 5 } });
    expect(result.vars).toEqual({ myVar: 'hello', count: 5 });
  });

  it('accepts custom paths.local', () => {
    const result = ProjectConfigSchema.parse({
      ...validConfig,
      paths: { local: 'custom/path' },
    });
    expect(result.paths.local).toBe('custom/path');
  });

  it('accepts inline recipes', () => {
    const result = ProjectConfigSchema.parse({
      ...validConfig,
      recipes: {
        'my-recipe': {
          description: 'A recipe',
          fragments: [{ fragment: 'some-fragment' }],
        },
      },
    });
    expect(result.recipes['my-recipe']).toBeDefined();
    expect(result.recipes['my-recipe'].description).toBe('A recipe');
  });

  describe('judge field', () => {
    it('applies default judge config when judge key is absent', () => {
      const result = ProjectConfigSchema.parse(validConfig);
      expect(result.judge.mode).toBe('heuristic');
      expect(result.judge.provider).toBe('anthropic');
      expect(result.judge.model).toBe('claude-haiku-4-5-20251001');
      expect(result.judge.cache).toBe(true);
      expect(result.judge.cache_ttl_hours).toBe(168);
      expect(result.judge.timeout_ms).toBe(30000);
      expect(result.judge.daily_limit).toBe(50);
      expect(result.judge.monthly_limit).toBe(500);
    });

    it('parses judge: { mode: llm, provider: openai }', () => {
      const result = ProjectConfigSchema.parse({
        ...validConfig,
        judge: { mode: 'llm', provider: 'openai' },
      });
      expect(result.judge.mode).toBe('llm');
      expect(result.judge.provider).toBe('openai');
      // remaining fields retain defaults
      expect(result.judge.model).toBe('claude-haiku-4-5-20251001');
    });

    it('throws on invalid mode', () => {
      expect(() =>
        ProjectConfigSchema.parse({ ...validConfig, judge: { mode: 'invalid' } }),
      ).toThrow();
    });

    it('throws when timeout_ms is below minimum (500)', () => {
      expect(() =>
        ProjectConfigSchema.parse({ ...validConfig, judge: { timeout_ms: 500 } }),
      ).toThrow();
    });
  });
});

describe('JudgeConfigSchema standalone', () => {
  it('parses empty object with all defaults', () => {
    const result = JudgeConfigSchema.parse({});
    expect(result.mode).toBe('heuristic');
    expect(result.cache_ttl_hours).toBe(168);
  });

  it('accepts hybrid mode', () => {
    const result = JudgeConfigSchema.parse({ mode: 'hybrid' });
    expect(result.mode).toBe('hybrid');
  });
});
