import { describe, it, expect } from 'vitest';
import { lintComposed, lintBehavior } from '../../src/intelligence/linter.js';
import type { LintResult } from '../../src/intelligence/linter.js';
import type { PromptMetrics, UsageEvent } from '../../src/schema/usage-event.js';

function makeMetrics(overrides: Partial<PromptMetrics> = {}): PromptMetrics {
  return {
    total_chars: 200,
    slot_count: 3,
    variable_count: 0,
    variable_filled: 0,
    has_constraint: true,
    has_example: false,
    has_context: false,
    sentence_count: 5,
    imperative_ratio: 0.5,
    ...overrides,
  };
}

function getSections(overrides: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {
    system: 'You are a helpful assistant.',
    instruction: 'Do the task carefully.',
    constraint: 'Never output harmful content.',
    ...overrides,
  };
  return base;
}

const defaultFullText = 'You are a helpful assistant. Do the task carefully. Never output harmful content.';

describe('PS001 — Missing Constraint (HIGH)', () => {
  it('reports PS001 HIGH when no constraint slot is present', () => {
    const sections = { system: 'You are an AI.', instruction: 'Do the task.' };
    const metrics = makeMetrics({ has_constraint: false, total_chars: 27 });
    const results: LintResult[] = lintComposed('You are an AI. Do the task.', sections, metrics);
    const ps001 = results.find((r) => r.id === 'PS001');
    expect(ps001).toBeDefined();
    expect(ps001?.severity).toBe('HIGH');
  });

  it('does NOT report PS001 when constraint slot is present', () => {
    const sections = getSections();
    const metrics = makeMetrics({ has_constraint: true });
    const results = lintComposed(defaultFullText, sections, metrics);
    const ps001 = results.find((r) => r.id === 'PS001');
    expect(ps001).toBeUndefined();
  });
});

describe('PS002 — Too Short (WARN)', () => {
  it('reports PS002 WARN when fullText is less than 100 chars', () => {
    const shortText = 'Short.';
    const sections = { instruction: shortText };
    const metrics = makeMetrics({ total_chars: shortText.length, has_constraint: false });
    const results = lintComposed(shortText, sections, metrics);
    const ps002 = results.find((r) => r.id === 'PS002');
    expect(ps002).toBeDefined();
    expect(ps002?.severity).toBe('WARN');
  });

  it('does NOT report PS002 when fullText is >= 100 chars', () => {
    const longText = 'A'.repeat(100);
    const sections = getSections({ instruction: longText });
    const metrics = makeMetrics({ total_chars: longText.length });
    const results = lintComposed(longText, sections, metrics);
    const ps002 = results.find((r) => r.id === 'PS002');
    expect(ps002).toBeUndefined();
  });
});

describe('PS003 — Too Long (WARN)', () => {
  it('reports PS003 WARN when fullText exceeds 8000 chars', () => {
    const longText = 'X'.repeat(8001);
    const sections = getSections({ instruction: longText });
    const metrics = makeMetrics({ total_chars: longText.length });
    const results = lintComposed(longText, sections, metrics);
    const ps003 = results.find((r) => r.id === 'PS003');
    expect(ps003).toBeDefined();
    expect(ps003?.severity).toBe('WARN');
  });

  it('does NOT report PS003 when fullText is <= 8000 chars', () => {
    const text = 'A'.repeat(8000);
    const sections = getSections({ instruction: text });
    const metrics = makeMetrics({ total_chars: text.length });
    const results = lintComposed(text, sections, metrics);
    const ps003 = results.find((r) => r.id === 'PS003');
    expect(ps003).toBeUndefined();
  });
});

describe('PS004 — No Role / No System Slot (WARN)', () => {
  it('reports PS004 WARN when system slot is absent', () => {
    const sections = { instruction: 'Do the task carefully and precisely.', constraint: 'Never output harmful content.' };
    const metrics = makeMetrics({ total_chars: 65 });
    const results = lintComposed(
      'Do the task carefully and precisely. Never output harmful content.',
      sections,
      metrics,
    );
    const ps004 = results.find((r) => r.id === 'PS004');
    expect(ps004).toBeDefined();
    expect(ps004?.severity).toBe('WARN');
  });

  it('does NOT report PS004 when system slot is present', () => {
    const sections = getSections();
    const metrics = makeMetrics();
    const results = lintComposed(defaultFullText, sections, metrics);
    const ps004 = results.find((r) => r.id === 'PS004');
    expect(ps004).toBeUndefined();
  });
});

describe('PS005 — Vague Variables (HIGH)', () => {
  it('reports PS005 HIGH when less than half variables are filled', () => {
    // variable_count=3, variable_filled=1 → fillRate < 0.5
    const sections = getSections();
    const metrics = makeMetrics({ variable_count: 3, variable_filled: 1 });
    const results = lintComposed(defaultFullText, sections, metrics);
    const ps005 = results.find((r) => r.id === 'PS005');
    expect(ps005).toBeDefined();
    expect(ps005?.severity).toBe('HIGH');
  });

  it('does NOT report PS005 when all variables are filled', () => {
    const sections = getSections();
    const metrics = makeMetrics({ variable_count: 2, variable_filled: 2 });
    const results = lintComposed(defaultFullText, sections, metrics);
    const ps005 = results.find((r) => r.id === 'PS005');
    expect(ps005).toBeUndefined();
  });

  it('does NOT report PS005 when no variables are declared', () => {
    const sections = getSections();
    const metrics = makeMetrics({ variable_count: 0, variable_filled: 0 });
    const results = lintComposed(defaultFullText, sections, metrics);
    const ps005 = results.find((r) => r.id === 'PS005');
    expect(ps005).toBeUndefined();
  });
});

describe('PS007 — Passive Voice / Low Imperative Ratio (WARN)', () => {
  it('reports PS007 WARN when imperative ratio in fullText is < 0.2', () => {
    // All descriptive sentences, no imperatives
    const passiveText = 'A'.repeat(150) + ' The system processes requests. It handles data. Results are returned.';
    const sections = getSections({ instruction: passiveText });
    const metrics = makeMetrics({ total_chars: passiveText.length, imperative_ratio: 0.0 });
    const results = lintComposed(passiveText, sections, metrics);
    const ps007 = results.find((r) => r.id === 'PS007');
    expect(ps007).toBeDefined();
    expect(ps007?.severity).toBe('WARN');
  });
});

describe('PS008 — Context Obesity (WARN)', () => {
  it('reports PS008 WARN when context chars exceed 60% of total', () => {
    const contextHeavy = 'C'.repeat(700);
    const rest = 'R'.repeat(300);
    const sections = { context: contextHeavy, instruction: rest, constraint: 'Never skip steps.', system: 'You are an AI.' };
    const fullText = contextHeavy + rest + 'Never skip steps. You are an AI.';
    const metrics = makeMetrics({ total_chars: fullText.length, has_context: true });
    const results = lintComposed(fullText, sections, metrics);
    const ps008 = results.find((r) => r.id === 'PS008');
    expect(ps008).toBeDefined();
    expect(ps008?.severity).toBe('WARN');
  });

  it('does NOT report PS008 when context chars are <= 60% of total', () => {
    const contextText = 'C'.repeat(300);
    const rest = 'R'.repeat(700);
    const sections = { context: contextText, instruction: rest, constraint: 'Never skip.', system: 'You are an AI.' };
    const fullText = contextText + rest;
    const metrics = makeMetrics({ total_chars: fullText.length, has_context: true });
    const results = lintComposed(fullText, sections, metrics);
    const ps008 = results.find((r) => r.id === 'PS008');
    expect(ps008).toBeUndefined();
  });
});

describe('lintComposed — all rules pass', () => {
  it('returns no HIGH results when all critical rules pass', () => {
    // Build a composed prompt that satisfies all static rules:
    // - has constraint slot (PS001 pass)
    // - >= 100 chars (PS002 pass)
    // - <= 8000 chars (PS003 pass)
    // - has system slot (PS004 pass)
    // - all vars filled (PS005 pass)
    // - high imperative ratio (PS007 pass)
    // - low context ratio (PS008 pass)
    const imperativeText =
      'Do the task. Always verify. Never skip. Check output. Write tests. Confirm results. Validate data.';
    const sections = { system: 'You are a helpful assistant.', instruction: imperativeText, constraint: 'Never output harmful content. Always verify results.' };
    const fullText = 'You are a helpful assistant. ' + imperativeText + ' Never output harmful content. Always verify results.';
    const metrics = makeMetrics({
      total_chars: fullText.length,
      has_constraint: true,
      variable_count: 1,
      variable_filled: 1,
      imperative_ratio: 0.8,
    });
    const results = lintComposed(fullText, sections, metrics);
    // Only check that no HIGH rules fire; some WARN may or may not fire
    const highResults = results.filter((r) => r.severity === 'HIGH');
    expect(highResults).toHaveLength(0);
  });
});

describe('lintComposed — result shape', () => {
  it('each LintResult has id, name, severity, and message fields', () => {
    const sections = { instruction: 'Short.' };
    const metrics = makeMetrics({ total_chars: 6, has_constraint: false });
    const results = lintComposed('Short.', sections, metrics);
    for (const r of results) {
      expect(typeof r.id).toBe('string');
      expect(typeof r.name).toBe('string');
      expect(['HIGH', 'WARN', 'INFO']).toContain(r.severity);
      expect(typeof r.message).toBe('string');
      expect(r.message.length).toBeGreaterThan(0);
    }
  });
});

// ── lintBehavior helpers ─────────────────────────────────────────────────────

const BASE_PROMPT_METRICS: PromptMetrics = {
  total_chars: 200,
  slot_count: 2,
  variable_count: 0,
  variable_filled: 0,
  has_constraint: true,
  has_example: false,
  has_context: false,
  sentence_count: 4,
  imperative_ratio: 0.5,
};

function makeApplyEvent(recipe: string, score?: number): UsageEvent {
  return {
    event_id: crypto.randomUUID(),
    event_type: 'apply',
    timestamp: new Date().toISOString(),
    recipe,
    fragments: [],
    adapter: 'generic',
    domain_tags: [],
    prompt_metrics: BASE_PROMPT_METRICS,
    outcome: score !== undefined ? { score } : undefined,
  };
}

function makeScoreEvent(recipe: string, score: number): UsageEvent {
  return {
    event_id: crypto.randomUUID(),
    event_type: 'score',
    timestamp: new Date().toISOString(),
    recipe,
    fragments: [],
    adapter: 'generic',
    domain_tags: [],
    prompt_metrics: BASE_PROMPT_METRICS,
    outcome: { score },
  };
}

// ── PS011 ────────────────────────────────────────────────────────────────────

describe('PS011 — Persistent Low Score (WARN)', () => {
  it('triggers when the last 5 scored events all have score < 0.5', () => {
    const events: UsageEvent[] = [
      // 6 scored events — oldest has score 0.8 (should be excluded from recent-5 window)
      makeScoreEvent('my-recipe', 0.8),
      makeScoreEvent('my-recipe', 0.2),
      makeScoreEvent('my-recipe', 0.3),
      makeScoreEvent('my-recipe', 0.1),
      makeScoreEvent('my-recipe', 0.4),
      makeScoreEvent('my-recipe', 0.2),
    ];
    const results = lintBehavior(events, 'my-recipe');
    const ps011 = results.find((r) => r.id === 'PS011');
    expect(ps011).toBeDefined();
    expect(ps011?.severity).toBe('WARN');
  });

  it('does NOT trigger when the recent 5 scored events are not all below 0.5', () => {
    const events: UsageEvent[] = [
      makeScoreEvent('my-recipe', 0.2),
      makeScoreEvent('my-recipe', 0.3),
      makeScoreEvent('my-recipe', 0.6), // one high score breaks the streak
      makeScoreEvent('my-recipe', 0.1),
      makeScoreEvent('my-recipe', 0.4),
    ];
    const results = lintBehavior(events, 'my-recipe');
    const ps011 = results.find((r) => r.id === 'PS011');
    expect(ps011).toBeUndefined();
  });

  it('does NOT trigger when fewer than 5 scored events exist', () => {
    const events: UsageEvent[] = [
      makeScoreEvent('my-recipe', 0.1),
      makeScoreEvent('my-recipe', 0.2),
      makeScoreEvent('my-recipe', 0.3),
      makeScoreEvent('my-recipe', 0.4),
    ];
    const results = lintBehavior(events, 'my-recipe');
    const ps011 = results.find((r) => r.id === 'PS011');
    expect(ps011).toBeUndefined();
  });

  it('ignores events from a different recipe', () => {
    const events: UsageEvent[] = [
      makeScoreEvent('other-recipe', 0.1),
      makeScoreEvent('other-recipe', 0.2),
      makeScoreEvent('other-recipe', 0.3),
      makeScoreEvent('other-recipe', 0.1),
      makeScoreEvent('other-recipe', 0.2),
    ];
    const results = lintBehavior(events, 'my-recipe');
    const ps011 = results.find((r) => r.id === 'PS011');
    expect(ps011).toBeUndefined();
  });
});

// ── PS012 ────────────────────────────────────────────────────────────────────

describe('PS012 — No Score Recorded (INFO)', () => {
  it('triggers when apply count >= 10 and zero scored events exist', () => {
    const events: UsageEvent[] = Array.from({ length: 10 }, () =>
      makeApplyEvent('my-recipe'),
    );
    const results = lintBehavior(events, 'my-recipe');
    const ps012 = results.find((r) => r.id === 'PS012');
    expect(ps012).toBeDefined();
    expect(ps012?.severity).toBe('INFO');
    expect(ps012?.message).toContain('10');
  });

  it('does NOT trigger when apply count >= 10 but at least one score exists', () => {
    const events: UsageEvent[] = [
      ...Array.from({ length: 10 }, () => makeApplyEvent('my-recipe')),
      makeScoreEvent('my-recipe', 0.7),
    ];
    const results = lintBehavior(events, 'my-recipe');
    const ps012 = results.find((r) => r.id === 'PS012');
    expect(ps012).toBeUndefined();
  });

  it('does NOT trigger when apply count is below 10', () => {
    const events: UsageEvent[] = Array.from({ length: 9 }, () =>
      makeApplyEvent('my-recipe'),
    );
    const results = lintBehavior(events, 'my-recipe');
    const ps012 = results.find((r) => r.id === 'PS012');
    expect(ps012).toBeUndefined();
  });

  it('counts only events matching the given recipe name', () => {
    // 10 applies for a different recipe — should not trigger for 'my-recipe'
    const events: UsageEvent[] = Array.from({ length: 10 }, () =>
      makeApplyEvent('other-recipe'),
    );
    const results = lintBehavior(events, 'my-recipe');
    const ps012 = results.find((r) => r.id === 'PS012');
    expect(ps012).toBeUndefined();
  });
});
