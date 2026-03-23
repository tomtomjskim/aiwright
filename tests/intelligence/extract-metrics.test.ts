import { describe, it, expect } from 'vitest';
import { extractPromptMetrics } from '../../src/intelligence/extract-metrics.js';

describe('extractPromptMetrics — empty input', () => {
  it('returns zero total_chars for empty string', () => {
    const result = extractPromptMetrics('', new Map());
    expect(result.total_chars).toBe(0);
  });

  it('returns zero slot_count for empty sections map', () => {
    const result = extractPromptMetrics('', new Map());
    expect(result.slot_count).toBe(0);
  });

  it('returns zero variable_count for empty input', () => {
    const result = extractPromptMetrics('', new Map());
    expect(result.variable_count).toBe(0);
  });

  it('returns zero variable_filled for empty input', () => {
    const result = extractPromptMetrics('', new Map());
    expect(result.variable_filled).toBe(0);
  });

  it('returns false for all boolean flags on empty input', () => {
    const result = extractPromptMetrics('', new Map());
    expect(result.has_constraint).toBe(false);
    expect(result.has_example).toBe(false);
    expect(result.has_context).toBe(false);
  });

  it('returns 0 for imperative_ratio on empty input', () => {
    const result = extractPromptMetrics('', new Map());
    expect(result.imperative_ratio).toBe(0);
  });
});

describe('extractPromptMetrics — imperative sentence detection', () => {
  it('detects "Do X" as imperative sentence', () => {
    const sections = new Map([['instruction', 'Do the task. Be thorough.']]);
    const result = extractPromptMetrics('Do the task. Be thorough.', sections);
    expect(result.imperative_ratio).toBeGreaterThan(0);
  });

  it('detects "Always Y" as imperative sentence', () => {
    const sections = new Map([['instruction', 'Always check the output. Verify results.']]);
    const result = extractPromptMetrics('Always check the output. Verify results.', sections);
    expect(result.imperative_ratio).toBeGreaterThan(0);
  });

  it('detects "Never Z" as imperative sentence', () => {
    const sections = new Map([['constraint', 'Never use passive voice. Avoid ambiguity.']]);
    const result = extractPromptMetrics('Never use passive voice. Avoid ambiguity.', sections);
    expect(result.imperative_ratio).toBeGreaterThan(0);
  });

  it('returns low imperative_ratio for descriptive-only text', () => {
    const text = 'The system is a customer service bot. It handles inquiries.';
    const sections = new Map([['context', text]]);
    const result = extractPromptMetrics(text, sections);
    expect(result.imperative_ratio).toBeLessThan(0.5);
  });
});

describe('extractPromptMetrics — variable detection', () => {
  it('detects {{name}} as a variable slot', () => {
    const text = 'Hello {{name}}, please help.';
    const sections = new Map([['instruction', text]]);
    const result = extractPromptMetrics(text, sections);
    expect(result.variable_count).toBeGreaterThan(0);
  });

  it('variable_filled is 0 when {{variables}} remain in rendered text', () => {
    // After rendering, remaining {{...}} are unfilled variables → variable_filled = 0
    const text = 'Hello {{name}}, how are you?';
    const sections = new Map([['instruction', text]]);
    const result = extractPromptMetrics(text, sections);
    expect(result.variable_filled).toBe(0);
  });

  it('slot_count reflects unique slots count (Map size)', () => {
    const sections = new Map([
      ['system', 'You are an AI.'],
      ['instruction', 'Do the task. Be precise.'],
    ]);
    const result = extractPromptMetrics('You are an AI. Do the task. Be precise.', sections);
    // 2 unique slots: system, instruction
    expect(result.slot_count).toBe(2);
  });

  it('slot_count is 1 when sections map has a single entry', () => {
    const sections = new Map([['instruction', 'First instruction. Second instruction.']]);
    const result = extractPromptMetrics('First instruction. Second instruction.', sections);
    expect(result.slot_count).toBe(1);
  });
});

describe('extractPromptMetrics — boolean flags', () => {
  it('has_constraint is true when constraint slot is present with content', () => {
    const sections = new Map([['constraint', 'Never output HTML.']]);
    const result = extractPromptMetrics('Never output HTML.', sections);
    expect(result.has_constraint).toBe(true);
  });

  it('has_example is true when example slot is present with content', () => {
    const sections = new Map([['example', 'Example: "Hello world"']]);
    const result = extractPromptMetrics('Example: "Hello world"', sections);
    expect(result.has_example).toBe(true);
  });

  it('has_context is true when context slot is present with content', () => {
    const sections = new Map([['context', 'Background: the user is a developer.']]);
    const result = extractPromptMetrics('Background: the user is a developer.', sections);
    expect(result.has_context).toBe(true);
  });

  it('has_constraint is false when constraint slot is absent', () => {
    const sections = new Map([['instruction', 'Do the task.']]);
    const result = extractPromptMetrics('Do the task.', sections);
    expect(result.has_constraint).toBe(false);
  });

  it('total_chars equals the length of fullText', () => {
    const fullText = 'AAAA' + 'BB'; // 6 chars
    const sections = new Map([
      ['system', 'AAAA'],
      ['instruction', 'BB'],
    ]);
    const result = extractPromptMetrics(fullText, sections);
    expect(result.total_chars).toBe(6);
  });
});
