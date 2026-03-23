import { describe, it, expect } from 'vitest';
import { FragmentSchema, FragmentFileSchema, SlotEnum } from '../../src/schema/fragment.js';

describe('SlotEnum', () => {
  it('accepts all valid slot values', () => {
    const validSlots = ['system', 'context', 'instruction', 'constraint', 'output', 'example', 'custom'];
    for (const slot of validSlots) {
      expect(SlotEnum.parse(slot)).toBe(slot);
    }
  });

  it('rejects invalid slot value', () => {
    expect(() => SlotEnum.parse('unknown-slot')).toThrow();
  });
});

describe('FragmentSchema', () => {
  const validFragment = {
    name: 'my-fragment',
    description: 'A test fragment',
    slot: 'instruction' as const,
  };

  it('parses a minimal valid fragment', () => {
    const result = FragmentSchema.parse(validFragment);
    expect(result.name).toBe('my-fragment');
    expect(result.description).toBe('A test fragment');
  });

  it('applies default values: version=0.1.0, priority=50, slot=instruction', () => {
    const result = FragmentSchema.parse(validFragment);
    expect(result.version).toBe('0.1.0');
    expect(result.priority).toBe(50);
    expect(result.slot).toBe('instruction');
  });

  it('applies default empty arrays for tags, model_hint, depends_on, conflicts_with', () => {
    const result = FragmentSchema.parse(validFragment);
    expect(result.tags).toEqual([]);
    expect(result.model_hint).toEqual([]);
    expect(result.depends_on).toEqual([]);
    expect(result.conflicts_with).toEqual([]);
  });

  it('accepts a fully specified fragment', () => {
    const full = {
      name: 'full-fragment',
      version: '1.2.3',
      description: 'Full fragment',
      tags: ['a', 'b'],
      model_hint: ['claude-3'],
      slot: 'system',
      slot_name: 'custom-slot',
      priority: 100,
      depends_on: ['dep-one'],
      conflicts_with: ['conflict-one'],
      variables: {
        myVar: {
          type: 'string',
          required: true,
          default: 'hello',
          description: 'A variable',
        },
      },
    };
    const result = FragmentSchema.parse(full);
    expect(result.name).toBe('full-fragment');
    expect(result.version).toBe('1.2.3');
    expect(result.priority).toBe(100);
    expect(result.conflicts_with).toEqual(['conflict-one']);
  });

  it('fails when name contains uppercase letters', () => {
    expect(() => FragmentSchema.parse({ ...validFragment, name: 'MyFragment' })).toThrow();
  });

  it('fails when name contains spaces', () => {
    expect(() => FragmentSchema.parse({ ...validFragment, name: 'my fragment' })).toThrow();
  });

  it('fails when name starts with a hyphen', () => {
    expect(() => FragmentSchema.parse({ ...validFragment, name: '-bad-name' })).toThrow();
  });

  it('fails when name is empty', () => {
    expect(() => FragmentSchema.parse({ ...validFragment, name: '' })).toThrow();
  });

  it('fails when description is missing', () => {
    const { description: _, ...noDesc } = validFragment;
    expect(() => FragmentSchema.parse(noDesc)).toThrow();
  });

  it('fails when description is empty', () => {
    expect(() => FragmentSchema.parse({ ...validFragment, description: '' })).toThrow();
  });

  it('fails with invalid version format', () => {
    expect(() => FragmentSchema.parse({ ...validFragment, version: '1.0' })).toThrow();
  });

  it('fails when priority is out of range (>999)', () => {
    expect(() => FragmentSchema.parse({ ...validFragment, priority: 1000 })).toThrow();
  });

  it('fails when priority is negative', () => {
    expect(() => FragmentSchema.parse({ ...validFragment, priority: -1 })).toThrow();
  });

  it('validates conflicts_with as array of strings', () => {
    const result = FragmentSchema.parse({ ...validFragment, conflicts_with: ['a', 'b', 'c'] });
    expect(result.conflicts_with).toEqual(['a', 'b', 'c']);
  });

  it('validates slot enum at parse time', () => {
    expect(() => FragmentSchema.parse({ ...validFragment, slot: 'invalid' })).toThrow();
  });

  it('accepts valid slot values: system, output, example, custom', () => {
    for (const slot of ['system', 'output', 'example', 'custom'] as const) {
      const result = FragmentSchema.parse({ ...validFragment, slot });
      expect(result.slot).toBe(slot);
    }
  });

  it('accepts hyphenated names like system-role', () => {
    const result = FragmentSchema.parse({ ...validFragment, name: 'system-role' });
    expect(result.name).toBe('system-role');
  });

  it('accepts alphanumeric names', () => {
    const result = FragmentSchema.parse({ ...validFragment, name: 'abc123' });
    expect(result.name).toBe('abc123');
  });
});

describe('FragmentFileSchema', () => {
  const validFragmentFile = {
    meta: {
      name: 'test-fragment',
      description: 'A test fragment',
      slot: 'instruction',
    },
    body: 'This is the fragment body content.',
  };

  it('parses a valid fragment file', () => {
    const result = FragmentFileSchema.parse(validFragmentFile);
    expect(result.meta.name).toBe('test-fragment');
    expect(result.body).toBe('This is the fragment body content.');
  });

  it('fails when body is empty', () => {
    expect(() => FragmentFileSchema.parse({ ...validFragmentFile, body: '' })).toThrow();
  });

  it('fails when meta is invalid', () => {
    expect(() => FragmentFileSchema.parse({ ...validFragmentFile, meta: { name: 'INVALID_NAME' } })).toThrow();
  });
});
