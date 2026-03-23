import { describe, it, expect } from 'vitest';
import { compose } from '../../src/core/composer.js';
import type { FragmentFile } from '../../src/schema/fragment.js';

function makeFragment(
  name: string,
  slot: FragmentFile['meta']['slot'],
  priority: number,
  body: string,
  overrides: Partial<FragmentFile['meta']> = {}
): FragmentFile {
  return {
    meta: {
      name,
      version: '0.1.0',
      description: `Fragment ${name}`,
      tags: [],
      model_hint: [],
      slot,
      priority,
      depends_on: [],
      conflicts_with: [],
      variables: {},
      ...overrides,
    },
    body,
  };
}

describe('compose', () => {
  it('returns fullText combining all fragment bodies', () => {
    const fragments = [
      makeFragment('system-frag', 'system', 10, 'System prompt.'),
      makeFragment('instruction-frag', 'instruction', 50, 'Do this task.'),
    ];
    const result = compose(fragments);
    expect(result.fullText).toContain('System prompt.');
    expect(result.fullText).toContain('Do this task.');
  });

  it('groups fragments by slot correctly', () => {
    const fragments = [
      makeFragment('sys', 'system', 10, 'System text'),
      makeFragment('inst', 'instruction', 50, 'Instruction text'),
      makeFragment('constraint', 'constraint', 50, 'Constraint text'),
    ];
    const result = compose(fragments);
    expect(result.sections.has('system')).toBe(true);
    expect(result.sections.has('instruction')).toBe(true);
    expect(result.sections.has('constraint')).toBe(true);
    expect(result.sections.get('system')).toBe('System text');
  });

  it('sorts fragments within a slot by priority (ascending)', () => {
    const fragments = [
      makeFragment('high-priority', 'instruction', 10, 'High priority.'),
      makeFragment('low-priority', 'instruction', 100, 'Low priority.'),
      makeFragment('mid-priority', 'instruction', 50, 'Mid priority.'),
    ];
    const result = compose(fragments);
    const instructionSection = result.sections.get('instruction')!;
    const highIdx = instructionSection.indexOf('High priority.');
    const midIdx = instructionSection.indexOf('Mid priority.');
    const lowIdx = instructionSection.indexOf('Low priority.');
    expect(highIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lowIdx);
  });

  it('respects slot ordering: system comes before instruction', () => {
    const fragments = [
      makeFragment('inst', 'instruction', 50, 'Instruction text'),
      makeFragment('sys', 'system', 50, 'System text'),
    ];
    const result = compose(fragments);
    const sysIdx = result.fullText.indexOf('System text');
    const instIdx = result.fullText.indexOf('Instruction text');
    expect(sysIdx).toBeLessThan(instIdx);
  });

  it('joins multiple fragments in the same slot with \\n\\n separator', () => {
    const fragments = [
      makeFragment('inst-a', 'instruction', 10, 'First instruction.'),
      makeFragment('inst-b', 'instruction', 20, 'Second instruction.'),
    ];
    const result = compose(fragments);
    expect(result.sections.get('instruction')).toBe('First instruction.\n\nSecond instruction.');
  });

  it('filters fragments by enabledNames set when provided', () => {
    const fragments = [
      makeFragment('enabled-frag', 'system', 10, 'Enabled body'),
      makeFragment('disabled-frag', 'instruction', 50, 'Disabled body'),
    ];
    const result = compose(fragments, new Set(['enabled-frag']));
    expect(result.fullText).toContain('Enabled body');
    expect(result.fullText).not.toContain('Disabled body');
    expect(result.fragments).toContain('enabled-frag');
    expect(result.fragments).not.toContain('disabled-frag');
  });

  it('returns empty fullText when no fragments are provided', () => {
    const result = compose([]);
    expect(result.fullText).toBe('');
    expect(result.fragments).toEqual([]);
  });

  it('collects variable defaults from fragments into resolvedVars', () => {
    const frag = makeFragment('frag-with-vars', 'instruction', 50, 'Body with {{tone}}', {
      variables: {
        tone: { type: 'string', required: false, default: 'formal', description: undefined },
      },
    });
    const result = compose([frag]);
    expect(result.resolvedVars).toHaveProperty('tone', 'formal');
  });

  it('earlier fragment variable default does not override later one (first-wins)', () => {
    const fragA = makeFragment('frag-a', 'system', 10, 'Body A', {
      variables: {
        shared: { type: 'string', required: false, default: 'first', description: undefined },
      },
    });
    const fragB = makeFragment('frag-b', 'instruction', 50, 'Body B', {
      variables: {
        shared: { type: 'string', required: false, default: 'second', description: undefined },
      },
    });
    const result = compose([fragA, fragB]);
    // first encountered default wins
    expect(result.resolvedVars['shared']).toBe('first');
  });

  it('tracks all used fragment names in the fragments array', () => {
    const fragments = [
      makeFragment('frag-x', 'system', 10, 'X body'),
      makeFragment('frag-y', 'instruction', 50, 'Y body'),
      makeFragment('frag-z', 'constraint', 50, 'Z body'),
    ];
    const result = compose(fragments);
    expect(result.fragments).toContain('frag-x');
    expect(result.fragments).toContain('frag-y');
    expect(result.fragments).toContain('frag-z');
  });

  it('handles custom slot with slot_name', () => {
    const frag = makeFragment('custom-frag', 'custom', 50, 'Custom body', {
      slot_name: 'my-custom-slot',
    });
    const result = compose([frag]);
    expect(result.sections.has('my-custom-slot')).toBe(true);
    expect(result.sections.get('my-custom-slot')).toBe('Custom body');
  });
});
