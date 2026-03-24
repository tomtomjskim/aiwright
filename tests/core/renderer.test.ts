import { describe, it, expect } from 'vitest';
import { render } from '../../src/core/renderer.js';
import type { ComposedPrompt } from '../../src/adapter/contract.js';

function makeComposed(
  fullText: string,
  sections: Record<string, string> = {},
  resolvedVars: Record<string, unknown> = {}
): ComposedPrompt {
  const sectionsRecord: Record<string, string> = { ...sections };
  if (!('full' in sectionsRecord)) {
    sectionsRecord['full'] = fullText;
  }
  return {
    sections: sectionsRecord,
    fullText,
    fragments: [],
    resolvedVars,
  };
}

describe('render', () => {
  it('substitutes a single Mustache variable', () => {
    const composed = makeComposed('Hello, {{name}}!', {}, {});
    const result = render(composed, { name: 'World' }, {});
    expect(result.fullText).toBe('Hello, World!');
  });

  it('substitutes multiple Mustache variables', () => {
    const composed = makeComposed('Dear {{role}}: please {{action}}.', {}, {});
    const result = render(composed, { role: 'Engineer', action: 'proceed' }, {});
    expect(result.fullText).toBe('Dear Engineer: please proceed.');
  });

  it('uses Fragment default vars when no override is provided', () => {
    const composed = makeComposed('Tone: {{tone}}', {}, { tone: 'formal' });
    const result = render(composed, {}, {});
    expect(result.fullText).toBe('Tone: formal');
  });

  it('recipeVars override resolvedVars (defaults)', () => {
    const composed = makeComposed('Tone: {{tone}}', {}, { tone: 'formal' });
    const result = render(composed, { tone: 'casual' }, {});
    expect(result.fullText).toBe('Tone: casual');
  });

  it('globalVars override resolvedVars but are overridden by recipeVars', () => {
    const composed = makeComposed('Tone: {{tone}}', {}, { tone: 'formal' });
    const result = render(composed, { tone: 'assertive' }, { tone: 'neutral' });
    expect(result.fullText).toBe('Tone: assertive');
  });

  it('globalVars fill in vars not in recipeVars', () => {
    const composed = makeComposed('Lang: {{lang}}, Mode: {{mode}}', {}, {});
    const result = render(composed, { mode: 'strict' }, { lang: 'en' });
    expect(result.fullText).toBe('Lang: en, Mode: strict');
  });

  it('leaves unknown variables as empty string (Mustache default)', () => {
    const composed = makeComposed('Hello, {{unknown}}!', {}, {});
    const result = render(composed, {}, {});
    // Mustache renders missing variables as empty string
    expect(result.fullText).toBe('Hello, !');
  });

  it('renders variables in sections as well', () => {
    const composed = makeComposed(
      '{{greeting}}',
      { system: 'You are a {{type}} assistant.' },
      {}
    );
    const result = render(composed, { type: 'helpful', greeting: 'Hi' }, {});
    expect(result.sections['system']).toBe('You are a helpful assistant.');
    expect(result.fullText).toBe('Hi');
  });

  it('does not HTML-escape angle brackets or special chars', () => {
    const composed = makeComposed('Result: {{value}}', {}, {});
    const result = render(composed, { value: '<b>bold</b>' }, {});
    expect(result.fullText).toBe('Result: <b>bold</b>');
  });

  it('returns updated resolvedVars merging all sources', () => {
    const composed = makeComposed('{{a}} {{b}} {{c}}', {}, { a: 'default-a' });
    const result = render(composed, { b: 'recipe-b' }, { c: 'global-c' });
    expect(result.resolvedVars).toMatchObject({
      a: 'default-a',
      b: 'recipe-b',
      c: 'global-c',
    });
  });

  it('handles empty fullText without errors', () => {
    const composed = makeComposed('', {}, {});
    const result = render(composed, {}, {});
    expect(result.fullText).toBe('');
  });
});
