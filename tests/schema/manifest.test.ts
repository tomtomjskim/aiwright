import { describe, it, expect } from 'vitest';
import { ApplyManifestSchema, ApplyRecordSchema } from '../../src/schema/manifest.js';

describe('ApplyRecordSchema', () => {
  const validRecord = {
    recipe: 'my-recipe',
    adapter: 'claude-code',
    applied_at: '2024-01-01T00:00:00.000Z',
    fragments_applied: ['frag-a', 'frag-b'],
    output_hash: 'abc123',
    output_path: '/project/CLAUDE.md',
  };

  it('parses a valid apply record', () => {
    const result = ApplyRecordSchema.parse(validRecord);
    expect(result.recipe).toBe('my-recipe');
    expect(result.adapter).toBe('claude-code');
    expect(result.fragments_applied).toEqual(['frag-a', 'frag-b']);
  });

  it('fails when applied_at is not a datetime string', () => {
    expect(() => ApplyRecordSchema.parse({ ...validRecord, applied_at: 'not-a-date' })).toThrow();
  });

  it('fails when recipe is missing', () => {
    const { recipe: _, ...noRecipe } = validRecord;
    expect(() => ApplyRecordSchema.parse(noRecipe)).toThrow();
  });

  it('accepts empty fragments_applied array', () => {
    const result = ApplyRecordSchema.parse({ ...validRecord, fragments_applied: [] });
    expect(result.fragments_applied).toEqual([]);
  });
});

describe('ApplyManifestSchema', () => {
  const validManifest = {
    version: '1' as const,
    history: [],
  };

  it('parses a minimal valid manifest', () => {
    const result = ApplyManifestSchema.parse(validManifest);
    expect(result.version).toBe('1');
    expect(result.history).toEqual([]);
  });

  it('accepts optional project field', () => {
    const result = ApplyManifestSchema.parse({ ...validManifest, project: 'my-project' });
    expect(result.project).toBe('my-project');
  });

  it('fails when version is not "1"', () => {
    expect(() => ApplyManifestSchema.parse({ ...validManifest, version: '2' })).toThrow();
  });

  it('accepts history with multiple records', () => {
    const record = {
      recipe: 'r',
      adapter: 'generic',
      applied_at: '2024-06-01T12:00:00.000Z',
      fragments_applied: ['f1'],
      output_hash: 'hash1',
      output_path: '/path',
    };
    const result = ApplyManifestSchema.parse({ ...validManifest, history: [record, record] });
    expect(result.history).toHaveLength(2);
  });
});
