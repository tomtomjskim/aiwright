import { describe, it, expect } from 'vitest';
import { extractPromptMetrics } from '../../src/intelligence/extract-metrics.js';

describe('extractPromptMetrics — empty input', () => {
  it('returns zero total_chars for empty string', () => {
    const result = extractPromptMetrics('', {});
    expect(result.total_chars).toBe(0);
  });

  it('returns zero slot_count for empty sections map', () => {
    const result = extractPromptMetrics('', {});
    expect(result.slot_count).toBe(0);
  });

  it('returns zero variable_count for empty input', () => {
    const result = extractPromptMetrics('', {});
    expect(result.variable_count).toBe(0);
  });

  it('returns zero variable_filled for empty input', () => {
    const result = extractPromptMetrics('', {});
    expect(result.variable_filled).toBe(0);
  });

  it('returns false for all boolean flags on empty input', () => {
    const result = extractPromptMetrics('', {});
    expect(result.has_constraint).toBe(false);
    expect(result.has_example).toBe(false);
    expect(result.has_context).toBe(false);
  });

  it('returns 0 for imperative_ratio on empty input', () => {
    const result = extractPromptMetrics('', {});
    expect(result.imperative_ratio).toBe(0);
  });
});

describe('extractPromptMetrics — imperative sentence detection', () => {
  it('detects "Do X" as imperative sentence', () => {
    const sections = { instruction: 'Do the task. Be thorough.' };
    const result = extractPromptMetrics('Do the task. Be thorough.', sections);
    expect(result.imperative_ratio).toBeGreaterThan(0);
  });

  it('detects "Always Y" as imperative sentence', () => {
    const sections = { instruction: 'Always check the output. Verify results.' };
    const result = extractPromptMetrics('Always check the output. Verify results.', sections);
    expect(result.imperative_ratio).toBeGreaterThan(0);
  });

  it('detects "Never Z" as imperative sentence', () => {
    const sections = { constraint: 'Never use passive voice. Avoid ambiguity.' };
    const result = extractPromptMetrics('Never use passive voice. Avoid ambiguity.', sections);
    expect(result.imperative_ratio).toBeGreaterThan(0);
  });

  it('returns low imperative_ratio for descriptive-only text', () => {
    const text = 'The system is a customer service bot. It handles inquiries.';
    const sections = { context: text };
    const result = extractPromptMetrics(text, sections);
    expect(result.imperative_ratio).toBeLessThan(0.5);
  });
});

describe('extractPromptMetrics — variable detection', () => {
  it('detects {{name}} as a variable slot', () => {
    const text = 'Hello {{name}}, please help.';
    const sections = { instruction: text };
    const result = extractPromptMetrics(text, sections);
    expect(result.variable_count).toBeGreaterThan(0);
  });

  it('variable_filled counts resolved vars minus unfilled when resolvedVars provided', () => {
    // resolvedVars has 2 keys (name, role), but rendered text still has {{name}} unfilled → filled = 1
    const text = 'Hello {{name}}, you are a {{role}}.';
    const sections = { instruction: text };
    // Simulate: {{role}} was filled (rendered away), {{name}} remains
    const renderedText = 'Hello {{name}}, you are a engineer.';
    const resolvedVars = { name: '{{name}}', role: 'engineer' };
    const result = extractPromptMetrics(renderedText, sections, resolvedVars);
    // totalVarCount=2, variable_count=1(unfilled) → variable_filled=1
    expect(result.variable_filled).toBe(1);
    expect(result.variable_count).toBe(1);
  });

  it('variable_filled is 0 when no resolvedVars and variables remain unfilled', () => {
    const text = 'Hello {{name}}, how are you?';
    const sections = { instruction: text };
    const result = extractPromptMetrics(text, sections);
    expect(result.variable_filled).toBe(0);
  });

  it('variable_filled equals resolvedVars count when all vars are filled (none remain)', () => {
    // After full render, no {{...}} left → variable_count=0, filled = totalVarCount
    const renderedText = 'Hello Alice, you are a developer.';
    const sections = { instruction: renderedText };
    const resolvedVars = { name: 'Alice', role: 'developer' };
    const result = extractPromptMetrics(renderedText, sections, resolvedVars);
    expect(result.variable_count).toBe(0);
    expect(result.variable_filled).toBe(2);
  });

  it('slot_count reflects unique slots count (Map size)', () => {
    const sections = { system: 'You are an AI.', instruction: 'Do the task. Be precise.' };
    const result = extractPromptMetrics('You are an AI. Do the task. Be precise.', sections);
    // 2 unique slots: system, instruction
    expect(result.slot_count).toBe(2);
  });

  it('slot_count is 1 when sections map has a single entry', () => {
    const sections = { instruction: 'First instruction. Second instruction.' };
    const result = extractPromptMetrics('First instruction. Second instruction.', sections);
    expect(result.slot_count).toBe(1);
  });
});

describe('extractPromptMetrics — context_chars', () => {
  it('returns context_chars equal to context section length', () => {
    const contextText = 'Background: the user is a developer.';
    const sections = { context: contextText };
    const result = extractPromptMetrics(contextText, sections);
    expect(result.context_chars).toBe(contextText.length);
  });

  it('returns context_chars = 0 when context section is absent', () => {
    const sections = { instruction: 'Do the task.' };
    const result = extractPromptMetrics('Do the task.', sections);
    expect(result.context_chars).toBe(0);
  });

  it('context_chars reflects raw length (not trimmed)', () => {
    const contextText = '  padded context  ';
    const sections = { context: contextText };
    const result = extractPromptMetrics(contextText, sections);
    expect(result.context_chars).toBe(contextText.length);
  });
});

describe('extractPromptMetrics — boolean flags', () => {
  it('has_constraint is true when constraint slot is present with content', () => {
    const sections = { constraint: 'Never output HTML.' };
    const result = extractPromptMetrics('Never output HTML.', sections);
    expect(result.has_constraint).toBe(true);
  });

  it('has_example is true when example slot is present with content', () => {
    const sections = { example: 'Example: "Hello world"' };
    const result = extractPromptMetrics('Example: "Hello world"', sections);
    expect(result.has_example).toBe(true);
  });

  it('has_context is true when context slot is present with content', () => {
    const sections = { context: 'Background: the user is a developer.' };
    const result = extractPromptMetrics('Background: the user is a developer.', sections);
    expect(result.has_context).toBe(true);
  });

  it('has_constraint is false when constraint slot is absent', () => {
    const sections = { instruction: 'Do the task.' };
    const result = extractPromptMetrics('Do the task.', sections);
    expect(result.has_constraint).toBe(false);
  });

  it('total_chars equals the length of fullText', () => {
    const fullText = 'AAAA' + 'BB'; // 6 chars
    const sections = { system: 'AAAA', instruction: 'BB' };
    const result = extractPromptMetrics(fullText, sections);
    expect(result.total_chars).toBe(6);
  });
});
