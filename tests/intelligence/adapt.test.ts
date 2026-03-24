import { describe, it, expect } from 'vitest';
import { adaptFragments } from '../../src/intelligence/adapt.js';
import type { UserProfile } from '../../src/schema/user-profile.js';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    version: '1',
    user_id: 'test-user',
    updated_at: new Date().toISOString(),
    style: {
      verbosity: 0.5,
      specificity: 0.5,
      context_ratio: 0.5,
      constraint_usage: 0.5,
      example_usage: 0.5,
      imperative_clarity: 0.5,
    },
    dna_code: 'ABCDEF',
    weaknesses: [],
    domains: [],
    adaptive: { enabled: true, rules: [] },
    growth: [],
    total_events: 0,
    ...overrides,
  };
}

describe('adaptFragments', () => {
  it('adaptive 비활성화 시 원본 entries와 빈 actions 반환', () => {
    const entries = [{ fragment: 'existing', enabled: true }];
    const profile = makeProfile({ adaptive: { enabled: false, rules: [] } });

    const result = adaptFragments(entries, profile);
    expect(result.entries).toBe(entries);
    expect(result.actions).toEqual([]);
  });

  it('constraint_usage < 0.2 시 constraint-no-hallucination 자동 주입', () => {
    const entries = [{ fragment: 'base', enabled: true }];
    const profile = makeProfile({
      style: {
        verbosity: 0.5,
        specificity: 0.5,
        context_ratio: 0.5,
        constraint_usage: 0.1,
        example_usage: 0.5,
        imperative_clarity: 0.5,
      },
    });

    const result = adaptFragments(entries, profile);
    expect(result.entries.some((e) => e.fragment === 'constraint-no-hallucination')).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('inject');
    expect(result.actions[0].fragment).toBe('constraint-no-hallucination');
  });

  it('constraint_usage >= 0.2 시 constraint-no-hallucination 주입하지 않음', () => {
    const entries = [{ fragment: 'base', enabled: true }];
    const profile = makeProfile({
      style: {
        verbosity: 0.5,
        specificity: 0.5,
        context_ratio: 0.5,
        constraint_usage: 0.3,
        example_usage: 0.5,
        imperative_clarity: 0.5,
      },
    });

    const result = adaptFragments(entries, profile);
    expect(result.entries.some((e) => e.fragment === 'constraint-no-hallucination')).toBe(false);
  });

  it('constraint-no-hallucination이 이미 존재하면 중복 주입 안 함', () => {
    const entries = [{ fragment: 'constraint-no-hallucination', enabled: true }];
    const profile = makeProfile({
      style: {
        verbosity: 0.5,
        specificity: 0.5,
        context_ratio: 0.5,
        constraint_usage: 0.1,
        example_usage: 0.5,
        imperative_clarity: 0.5,
      },
    });

    const result = adaptFragments(entries, profile);
    const count = result.entries.filter((e) => e.fragment === 'constraint-no-hallucination').length;
    expect(count).toBe(1);
    expect(result.actions).toHaveLength(0);
  });

  it('example_usage === 0 시 output-markdown 자동 주입', () => {
    const entries = [{ fragment: 'base', enabled: true }];
    const profile = makeProfile({
      style: {
        verbosity: 0.5,
        specificity: 0.5,
        context_ratio: 0.5,
        constraint_usage: 0.5,
        example_usage: 0,
        imperative_clarity: 0.5,
      },
    });

    const result = adaptFragments(entries, profile);
    expect(result.entries.some((e) => e.fragment === 'output-markdown')).toBe(true);
    const action = result.actions.find((a) => a.fragment === 'output-markdown');
    expect(action).toBeDefined();
    expect(action?.type).toBe('inject');
  });

  it('example_usage > 0 시 output-markdown 주입하지 않음', () => {
    const entries = [{ fragment: 'base', enabled: true }];
    const profile = makeProfile({
      style: {
        verbosity: 0.5,
        specificity: 0.5,
        context_ratio: 0.5,
        constraint_usage: 0.5,
        example_usage: 0.1,
        imperative_clarity: 0.5,
      },
    });

    const result = adaptFragments(entries, profile);
    expect(result.entries.some((e) => e.fragment === 'output-markdown')).toBe(false);
  });

  it('사용자 정의 rules 순회하여 inject', () => {
    const entries = [{ fragment: 'base', enabled: true }];
    const profile = makeProfile({
      adaptive: {
        enabled: true,
        rules: [{ when: 'always', inject: 'custom-fragment', reason: '사용자 설정' }],
      },
    });

    const result = adaptFragments(entries, profile);
    expect(result.entries.some((e) => e.fragment === 'custom-fragment')).toBe(true);
    const action = result.actions.find((a) => a.fragment === 'custom-fragment');
    expect(action?.reason).toBe('사용자 설정');
  });

  it('사용자 정의 rules — 이미 존재하는 fragment는 중복 주입 안 함', () => {
    const entries = [{ fragment: 'custom-fragment', enabled: true }];
    const profile = makeProfile({
      adaptive: {
        enabled: true,
        rules: [{ when: 'always', inject: 'custom-fragment', reason: '사용자 설정' }],
      },
    });

    const result = adaptFragments(entries, profile);
    const count = result.entries.filter((e) => e.fragment === 'custom-fragment').length;
    expect(count).toBe(1);
    const action = result.actions.find((a) => a.fragment === 'custom-fragment');
    expect(action).toBeUndefined();
  });

  it('두 조건 모두 충족 시 두 fragment 모두 주입', () => {
    const entries: { fragment: string; enabled: boolean }[] = [];
    const profile = makeProfile({
      style: {
        verbosity: 0.5,
        specificity: 0.5,
        context_ratio: 0.5,
        constraint_usage: 0.1,
        example_usage: 0,
        imperative_clarity: 0.5,
      },
    });

    const result = adaptFragments(entries, profile);
    expect(result.entries).toHaveLength(2);
    expect(result.actions).toHaveLength(2);
  });

  it('빈 entries와 빈 rules — 조건 미충족 시 변경 없음', () => {
    const entries: { fragment: string }[] = [];
    const profile = makeProfile();  // constraint_usage=0.5, example_usage=0.5

    const result = adaptFragments(entries, profile);
    expect(result.entries).toHaveLength(0);
    expect(result.actions).toHaveLength(0);
  });
});
