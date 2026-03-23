import { describe, it, expect } from 'vitest';
import { generateKata, type Kata } from '../../src/intelligence/kata.js';
import type { PromptStyle, Weakness } from '../../src/schema/user-profile.js';

function zeroStyle(): PromptStyle {
  return {
    verbosity: 0,
    specificity: 0,
    context_ratio: 0,
    constraint_usage: 0,
    example_usage: 0,
    imperative_clarity: 0,
  };
}

function highStyle(): PromptStyle {
  return {
    verbosity: 0.9,
    specificity: 0.9,
    context_ratio: 0.9,
    constraint_usage: 0.9,
    example_usage: 0.9,
    imperative_clarity: 0.9,
  };
}

function makeWeakness(id: string, severity: 'HIGH' | 'WARN' | 'INFO' = 'HIGH'): Weakness {
  return {
    id,
    severity,
    message: `Test weakness ${id}`,
    suggestion: 'Test suggestion',
  };
}

describe('generateKata', () => {
  it('constraint 약점(W001)이 있으면 Constraint 관련 챌린지가 반환된다', () => {
    const weaknesses = [makeWeakness('W001')];
    const kata = generateKata(weaknesses, highStyle());
    expect(kata.target_skill).toBe('Constraint');
  });

  it('specificity 약점(W002)이 있으면 Specificity 관련 챌린지가 반환된다', () => {
    const weaknesses = [makeWeakness('W002')];
    const kata = generateKata(weaknesses, highStyle());
    expect(kata.target_skill).toBe('Specificity');
  });

  it('example_usage 약점(W004)이 있으면 Examples 관련 챌린지가 반환된다', () => {
    const weaknesses = [makeWeakness('W004', 'INFO')];
    const kata = generateKata(weaknesses, highStyle());
    expect(kata.target_skill).toBe('Examples');
  });

  it('imperative_clarity 약점(W005)이 있으면 Imperative Clarity 챌린지가 반환된다', () => {
    const weaknesses = [makeWeakness('W005', 'WARN')];
    const kata = generateKata(weaknesses, highStyle());
    expect(kata.target_skill).toBe('Imperative Clarity');
  });

  it('약점 없고 스타일 높으면 hard 난이도 챌린지가 반환된다', () => {
    const kata = generateKata([], highStyle());
    expect(kata.difficulty).toBe('hard');
  });

  it('example_usage = 0이면 Examples 챌린지가 반환된다', () => {
    const style: PromptStyle = { ...highStyle(), example_usage: 0 };
    const kata = generateKata([], style);
    expect(kata.target_skill).toBe('Examples');
  });

  it('constraint_usage = 0이면 Constraint 챌린지가 반환된다', () => {
    const style: PromptStyle = { ...highStyle(), constraint_usage: 0 };
    const kata = generateKata([], style);
    expect(kata.target_skill).toBe('Constraint');
  });

  it('반환된 Kata에 id가 있다', () => {
    const kata = generateKata([], highStyle());
    expect(kata.id).toBeDefined();
    expect(kata.id.length).toBeGreaterThan(0);
  });

  it('반환된 Kata에 title이 있다', () => {
    const kata = generateKata([], highStyle());
    expect(kata.title).toBeDefined();
    expect(kata.title.length).toBeGreaterThan(0);
  });

  it('반환된 Kata에 task가 있다', () => {
    const kata = generateKata([], highStyle());
    expect(kata.task).toBeDefined();
    expect(kata.task.length).toBeGreaterThan(0);
  });

  it('반환된 Kata에 success_criteria 배열이 있다', () => {
    const kata = generateKata([], highStyle());
    expect(Array.isArray(kata.success_criteria)).toBe(true);
    expect(kata.success_criteria.length).toBeGreaterThan(0);
  });

  it('반환된 Kata의 difficulty는 easy/medium/hard 중 하나다', () => {
    const kata = generateKata([makeWeakness('W001')], highStyle());
    expect(['easy', 'medium', 'hard']).toContain(kata.difficulty);
  });

  it('여러 약점이 있으면 첫 번째 약점 기반 챌린지가 반환된다', () => {
    const weaknesses = [makeWeakness('W001'), makeWeakness('W004', 'INFO')];
    const kata = generateKata(weaknesses, highStyle());
    // W001 = Constraint 이 첫 번째
    expect(kata.target_skill).toBe('Constraint');
  });
});
