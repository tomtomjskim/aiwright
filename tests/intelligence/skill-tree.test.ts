import { describe, it, expect } from 'vitest';
import { buildSkillTree, renderSkillTree, type SkillNode } from '../../src/intelligence/skill-tree.js';
import type { PromptStyle, BehaviorProfile } from '../../src/schema/user-profile.js';

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
    specificity: 0.85,
    context_ratio: 0.8,
    constraint_usage: 0.75,
    example_usage: 0.7,
    imperative_clarity: 0.95,
  };
}

function midStyle(): PromptStyle {
  return {
    verbosity: 0.5,
    specificity: 0.5,
    context_ratio: 0.5,
    constraint_usage: 0.5,
    example_usage: 0.5,
    imperative_clarity: 0.5,
  };
}

function highBehavior(): BehaviorProfile {
  return {
    ftrr: 0.9,
    delegation_maturity: 4,
    context_obesity: 0.1,
  };
}

function lowBehavior(): BehaviorProfile {
  return {
    ftrr: 0.0,
    delegation_maturity: 1,
    context_obesity: 1.0,
  };
}

describe('buildSkillTree', () => {
  it('모든 값이 0이면 모든 leaf node가 locked (level 0)이다', () => {
    const root = buildSkillTree(zeroStyle());
    expect(root.name).toBe('AI Craft');
    expect(root.children).toBeDefined();

    for (const branch of root.children ?? []) {
      for (const leaf of branch.children ?? []) {
        expect(leaf.level).toBe(0);
      }
    }
  });

  it('높은 값이면 leaf node가 master (level 3)이다', () => {
    const root = buildSkillTree(highStyle());
    let masterCount = 0;
    for (const branch of root.children ?? []) {
      for (const leaf of branch.children ?? []) {
        if (leaf.level === 3) masterCount++;
      }
    }
    expect(masterCount).toBeGreaterThan(0);
  });

  it('루트 이름이 "AI Craft"이다', () => {
    const root = buildSkillTree(zeroStyle());
    expect(root.name).toBe('AI Craft');
  });

  it('behavior 없으면 Efficiency 가지가 없다', () => {
    const root = buildSkillTree(midStyle());
    const branchNames = (root.children ?? []).map((b) => b.name);
    expect(branchNames).not.toContain('Efficiency');
    expect(branchNames).toContain('Structure');
    expect(branchNames).toContain('Precision');
  });

  it('behavior가 있으면 Efficiency 가지가 생긴다', () => {
    const root = buildSkillTree(midStyle(), highBehavior());
    const branchNames = (root.children ?? []).map((b) => b.name);
    expect(branchNames).toContain('Efficiency');
  });

  it('Structure 가지는 System Role, Context, Constraint 포함', () => {
    const root = buildSkillTree(midStyle());
    const structure = root.children?.find((b) => b.name === 'Structure');
    expect(structure).toBeDefined();
    const leafNames = (structure?.children ?? []).map((l) => l.name);
    expect(leafNames).toContain('System Role');
    expect(leafNames).toContain('Context');
    expect(leafNames).toContain('Constraint');
  });

  it('Precision 가지는 Specificity, Imperative Clarity, Examples 포함', () => {
    const root = buildSkillTree(midStyle());
    const precision = root.children?.find((b) => b.name === 'Precision');
    expect(precision).toBeDefined();
    const leafNames = (precision?.children ?? []).map((l) => l.name);
    expect(leafNames).toContain('Specificity');
    expect(leafNames).toContain('Imperative Clarity');
    expect(leafNames).toContain('Examples');
  });

  it('behavior 낮으면 Efficiency 노드들이 locked이다', () => {
    const root = buildSkillTree(zeroStyle(), lowBehavior());
    const efficiency = root.children?.find((b) => b.name === 'Efficiency');
    expect(efficiency).toBeDefined();

    // ftrr=0 → level 0, delegation=1 → score=(1-1)/3=0 → level 0, context_obesity=1 → tokenEff=0 → level 0
    for (const leaf of efficiency?.children ?? []) {
      expect(leaf.level).toBe(0);
    }
  });

  it('score 0.4~0.69는 intermediate (level 2)', () => {
    const style: PromptStyle = {
      ...zeroStyle(),
      constraint_usage: 0.5,
    };
    const root = buildSkillTree(style);
    const structure = root.children?.find((b) => b.name === 'Structure');
    const constraint = structure?.children?.find((l) => l.name === 'Constraint');
    expect(constraint?.level).toBe(2);
  });

  it('score >= 0.7은 master (level 3)', () => {
    const style: PromptStyle = {
      ...zeroStyle(),
      constraint_usage: 0.75,
    };
    const root = buildSkillTree(style);
    const structure = root.children?.find((b) => b.name === 'Structure');
    const constraint = structure?.children?.find((l) => l.name === 'Constraint');
    expect(constraint?.level).toBe(3);
  });
});

describe('renderSkillTree', () => {
  it('루트 이름이 첫 번째 줄에 출력된다', () => {
    const root = buildSkillTree(midStyle());
    const output = renderSkillTree(root);
    const lines = output.split('\n');
    expect(lines[0]).toBe('AI Craft');
  });

  it('가지 이름이 출력에 포함된다', () => {
    const root = buildSkillTree(midStyle());
    const output = renderSkillTree(root);
    expect(output).toContain('Structure');
    expect(output).toContain('Precision');
  });

  it('leaf 이름이 출력에 포함된다', () => {
    const root = buildSkillTree(midStyle());
    const output = renderSkillTree(root);
    expect(output).toContain('Constraint');
    expect(output).toContain('Specificity');
    expect(output).toContain('Examples');
  });

  it('level 0 노드에 UNLOCK 힌트가 포함된다', () => {
    const root = buildSkillTree(zeroStyle());
    const output = renderSkillTree(root);
    expect(output).toContain('UNLOCK:');
  });

  it('별 표시(★/☆)가 포함된다', () => {
    const root = buildSkillTree(midStyle());
    const output = renderSkillTree(root);
    expect(output).toMatch(/[★☆]/);
  });

  it('올바른 트리 구분자(├──, └──)가 있다', () => {
    const root = buildSkillTree(midStyle());
    const output = renderSkillTree(root);
    expect(output).toContain('├──');
    expect(output).toContain('└──');
  });

  it('막대 그래프([█░])가 포함된다', () => {
    const root = buildSkillTree(midStyle());
    const output = renderSkillTree(root);
    expect(output).toMatch(/\[[█░]+\]/);
  });

  it('behavior 있으면 Efficiency 가지도 출력된다', () => {
    const root = buildSkillTree(midStyle(), highBehavior());
    const output = renderSkillTree(root);
    expect(output).toContain('Efficiency');
    expect(output).toContain('First-Turn Rate');
  });
});
