import { describe, it, expect } from 'vitest';
import { generateTuneActions } from '../../src/intelligence/self-tune.js';
import { type DriftReport } from '../../src/intelligence/drift.js';
import { type JudgeResult } from '../../src/intelligence/llm-judge.js';
import { type UserProfile } from '../../src/schema/user-profile.js';

function makeDrift(level: DriftReport['level'], overrides: Partial<DriftReport> = {}): DriftReport {
  return {
    recipe: 'default',
    level,
    consecutive_low: 0,
    avg_recent: 0.5,
    avg_previous: 0.7,
    trend: 'stable',
    message: 'Test message',
    ...overrides,
  };
}

function makeJudge(overrides: Partial<JudgeResult> = {}): JudgeResult {
  return {
    score: 0.7,
    feedback: 'Test feedback',
    strengths: [],
    weaknesses: [],
    model: 'heuristic-sim-v1',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    version: '1',
    user_id: 'test',
    updated_at: new Date().toISOString(),
    style: {
      verbosity: 0.5,
      specificity: 0.5,
      context_ratio: 0.5,
      constraint_usage: 0.5,
      example_usage: 0.0,
      imperative_clarity: 0.5,
    },
    dna_code: 'AW-V5S5R5',
    weaknesses: [],
    domains: [],
    adaptive: { enabled: false, rules: [] },
    growth: [],
    total_events: 10,
    ...overrides,
  };
}

describe('generateTuneActions — drift none', () => {
  it('returns empty actions when drift level is none', () => {
    const drift = makeDrift('none');
    const judge = makeJudge();
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    expect(actions).toEqual([]);
  });

  it('returns empty actions even when judge has weaknesses but drift is none', () => {
    const drift = makeDrift('none');
    const judge = makeJudge({ weaknesses: ['No constraint slot', 'No example slot'] });
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    expect(actions).toEqual([]);
  });
});

describe('generateTuneActions — drift warning', () => {
  it('returns warn action for warning drift level', () => {
    const drift = makeDrift('warning', { consecutive_low: 3, trend: 'declining' });
    const judge = makeJudge();
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const warnAction = actions.find((a) => a.type === 'warn');
    expect(warnAction).toBeDefined();
  });

  it('warn action targets the recipe name', () => {
    const drift = makeDrift('warning', { recipe: 'my-recipe', consecutive_low: 3 });
    const judge = makeJudge();
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const warnAction = actions.find((a) => a.type === 'warn');
    expect(warnAction?.target).toBe('my-recipe');
  });

  it('warn action includes reason text', () => {
    const drift = makeDrift('warning', { consecutive_low: 3 });
    const judge = makeJudge();
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const warnAction = actions.find((a) => a.type === 'warn');
    expect(warnAction?.reason.length).toBeGreaterThan(0);
  });
});

describe('generateTuneActions — drift adjustment', () => {
  it('returns suggest_replace action when drift is adjustment with weaknesses', () => {
    const drift = makeDrift('adjustment', { consecutive_low: 5 });
    const judge = makeJudge({ weaknesses: ['No constraint slot (hallucination risk)', 'Low imperative clarity'] });
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const replaceAction = actions.find((a) => a.type === 'suggest_replace');
    expect(replaceAction).toBeDefined();
  });

  it('suggest_replace action has reason and target', () => {
    const drift = makeDrift('adjustment', { consecutive_low: 5 });
    const judge = makeJudge({ weaknesses: ['No constraint slot (hallucination risk)'] });
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const replaceAction = actions.find((a) => a.type === 'suggest_replace');
    expect(replaceAction?.target).toBeDefined();
    expect(replaceAction?.reason.length).toBeGreaterThan(0);
  });

  it('suggest_replace uses profile fragment when HIGH weakness exists', () => {
    const drift = makeDrift('adjustment', { consecutive_low: 5 });
    const judge = makeJudge({ weaknesses: ['No constraint slot (hallucination risk)'] });
    const profile = makeProfile({
      weaknesses: [
        {
          id: 'W001',
          severity: 'HIGH',
          message: 'Missing constraint',
          fragment: 'constraint',
        },
      ],
    });
    const actions = generateTuneActions(drift, judge, profile);
    const replaceAction = actions.find((a) => a.type === 'suggest_replace');
    expect(replaceAction).toBeDefined();
    expect(replaceAction?.target).toBe('constraint');
    expect(replaceAction?.replacement).toContain('constraint');
  });

  it('no suggest_replace when adjustment but no weaknesses from judge', () => {
    const drift = makeDrift('adjustment', { consecutive_low: 5 });
    const judge = makeJudge({ weaknesses: [] });
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const replaceAction = actions.find((a) => a.type === 'suggest_replace');
    // weaknesses 없으면 suggest_replace 없음
    expect(replaceAction).toBeUndefined();
  });
});

describe('generateTuneActions — drift deactivation', () => {
  it('returns suggest_disable action for deactivation level', () => {
    const drift = makeDrift('deactivation', { consecutive_low: 7 });
    const judge = makeJudge();
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const disableAction = actions.find((a) => a.type === 'suggest_disable');
    expect(disableAction).toBeDefined();
  });

  it('suggest_disable targets the recipe', () => {
    const drift = makeDrift('deactivation', { recipe: 'bad-recipe', consecutive_low: 7 });
    const judge = makeJudge();
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const disableAction = actions.find((a) => a.type === 'suggest_disable');
    expect(disableAction?.target).toBe('bad-recipe');
  });

  it('suggest_disable reason mentions consecutive low count', () => {
    const drift = makeDrift('deactivation', { consecutive_low: 8 });
    const judge = makeJudge();
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const disableAction = actions.find((a) => a.type === 'suggest_disable');
    expect(disableAction?.reason).toContain('8');
  });
});

describe('generateTuneActions — suggest_add from judge weaknesses', () => {
  it('adds suggest_add for constraint when judge reports missing constraint', () => {
    const drift = makeDrift('warning');
    const judge = makeJudge({ weaknesses: ['No constraint slot (hallucination risk)'] });
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const addAction = actions.find((a) => a.type === 'suggest_add' && a.target === 'constraint');
    expect(addAction).toBeDefined();
  });

  it('adds suggest_add for example when judge reports missing few-shot', () => {
    const drift = makeDrift('warning');
    const judge = makeJudge({ weaknesses: ['No example slot (few-shot missing)'] });
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const addAction = actions.find((a) => a.type === 'suggest_add' && a.target === 'example');
    expect(addAction).toBeDefined();
  });

  it('does not add suggest_add when no relevant weaknesses', () => {
    const drift = makeDrift('warning');
    const judge = makeJudge({ weaknesses: ['Low imperative clarity'] });
    const profile = makeProfile();
    const actions = generateTuneActions(drift, judge, profile);
    const addActions = actions.filter((a) => a.type === 'suggest_add');
    expect(addActions.length).toBe(0);
  });
});
