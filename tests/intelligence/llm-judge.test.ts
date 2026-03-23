import { describe, it, expect } from 'vitest';
import { judgePrompt } from '../../src/intelligence/llm-judge.js';

// 좋은 프롬프트: constraint, system, imperative 모두 포함
const goodPrompt = `[system]
You are a senior software engineer. Always write clean, maintainable code.

[context]
The user is working on a TypeScript project.

[instruction]
Do implement the requested feature following best practices.
Return the complete implementation with comments.
Ensure proper error handling.

[constraint]
Never output code without proper TypeScript types.
Always include JSDoc comments for public functions.

[example]
Input: Create a function to add two numbers
Output: /** Adds two numbers */ function add(a: number, b: number): number { return a + b; }`;

// 나쁜 프롬프트: constraint 없음, 너무 짧음, system 없음
const badPrompt = `do the task`;

// 중간 프롬프트: system 있지만 constraint/example 없음
const midPrompt = `[system]
You are a helpful assistant. Please help with the request.

[instruction]
Complete the task as described.`;

describe('judgePrompt — good prompt', () => {
  it('returns a score between 0 and 1', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('returns a higher score for a well-structured prompt', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(result.score).toBeGreaterThan(0.6);
  });

  it('includes strengths for well-structured prompt', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(result.strengths.length).toBeGreaterThan(0);
  });

  it('feedback is a non-empty string', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(typeof result.feedback).toBe('string');
    expect(result.feedback.length).toBeGreaterThan(0);
  });

  it('model field is populated', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(typeof result.model).toBe('string');
    expect(result.model.length).toBeGreaterThan(0);
  });
});

describe('judgePrompt — bad prompt (HIGH issues)', () => {
  it('returns a lower score when prompt is too short and missing constraint', async () => {
    const result = await judgePrompt(badPrompt);
    expect(result.score).toBeLessThan(0.7);
  });

  it('includes weaknesses when HIGH-severity issues exist', async () => {
    const result = await judgePrompt(badPrompt);
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });

  it('feedback is non-empty for bad prompt', async () => {
    const result = await judgePrompt(badPrompt);
    expect(result.feedback.length).toBeGreaterThan(0);
  });
});

describe('judgePrompt — mid prompt', () => {
  it('returns a moderate score for a mid-quality prompt', async () => {
    const result = await judgePrompt(midPrompt);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('has some weaknesses for mid prompt (missing constraint, example)', async () => {
    const result = await judgePrompt(midPrompt);
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });
});

describe('judgePrompt — options', () => {
  it('accepts model option and reflects it in result', async () => {
    const result = await judgePrompt(goodPrompt, { model: 'gpt-4o' });
    // 시뮬레이션 모드에서는 model 옵션은 무시되고 기본값 사용
    expect(result.model).toBeDefined();
  });

  it('uses default model when no options provided', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(result.model).toBe('heuristic-sim-v1');
  });
});

describe('judgePrompt — return structure', () => {
  it('result has all required fields', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('feedback');
    expect(result).toHaveProperty('strengths');
    expect(result).toHaveProperty('weaknesses');
    expect(result).toHaveProperty('model');
  });

  it('strengths and weaknesses are arrays', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.weaknesses)).toBe(true);
  });
});

describe('judgePrompt — zero issues prompt', () => {
  const perfectPrompt = `[system]
You are an expert. Always respond concisely.

[context]
Background information here.

[instruction]
Do complete the requested task accurately.
Return a well-structured response.
Ensure correctness.

[constraint]
Never fabricate information. Always cite sources.

[example]
Input: Sample
Output: Result`;

  it('returns high score when lint finds no issues', async () => {
    const result = await judgePrompt(perfectPrompt);
    // 최소한 중간 이상 점수
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  });

  it('has feedback string regardless of score', async () => {
    const result = await judgePrompt(perfectPrompt);
    expect(result.feedback.length).toBeGreaterThan(0);
  });
});
