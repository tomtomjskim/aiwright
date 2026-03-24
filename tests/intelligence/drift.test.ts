import { describe, it, expect } from 'vitest';
import { detectDrift } from '../../src/intelligence/drift.js';
import { type UsageEvent } from '../../src/schema/usage-event.js';
import { randomUUID } from 'node:crypto';

function makeEvent(
  recipe: string,
  score: number | undefined,
  overrides: Partial<UsageEvent> = {},
): UsageEvent {
  return {
    event_id: randomUUID(),
    event_type: 'score',
    timestamp: new Date().toISOString(),
    recipe,
    fragments: [],
    adapter: 'generic',
    domain_tags: [],
    prompt_metrics: {
      total_chars: 200,
      slot_count: 3,
      has_constraint: true,
      has_example: false,
      has_context: false,
      variable_count: 0,
      variable_filled: 0,
      sentence_count: 5,
      imperative_ratio: 0.4,
    },
    outcome: score !== undefined ? { score } : undefined,
    ...overrides,
  };
}

function makeEvents(recipe: string, scores: (number | undefined)[]): UsageEvent[] {
  return scores.map((s) => makeEvent(recipe, s));
}

/**
 * 시간 윈도우 테스트용 헬퍼: now 기준 daysAgo일 전 타임스탬프를 가진 이벤트 생성
 */
function makeEventDaysAgo(
  recipe: string,
  score: number,
  daysAgo: number,
  now: Date,
): UsageEvent {
  const ts = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return makeEvent(recipe, score, { timestamp: ts });
}

describe('detectDrift — no events', () => {
  it('returns level none when no events exist', () => {
    const report = detectDrift([], 'default');
    expect(report.level).toBe('none');
    expect(report.consecutive_low).toBe(0);
  });

  it('returns level none when no scored events for recipe', () => {
    const events = makeEvents('other', [0.2, 0.2, 0.2]);
    const report = detectDrift(events, 'default');
    expect(report.level).toBe('none');
  });

  it('returns recipe name in report', () => {
    const report = detectDrift([], 'my-recipe');
    expect(report.recipe).toBe('my-recipe');
  });
});

describe('detectDrift — warning (3 consecutive < 0.5)', () => {
  it('returns warning when 3 consecutive scores below 0.5', () => {
    const events = makeEvents('default', [0.8, 0.9, 0.4, 0.4, 0.4]);
    const report = detectDrift(events, 'default');
    expect(report.level).toBe('warning');
    expect(report.consecutive_low).toBe(3);
  });

  it('does NOT return warning for only 2 consecutive low scores', () => {
    const events = makeEvents('default', [0.8, 0.9, 0.4, 0.4]);
    const report = detectDrift(events, 'default');
    expect(report.level).toBe('none');
  });

  it('warning level has suggestion text', () => {
    const events = makeEvents('default', [0.8, 0.4, 0.4, 0.4]);
    const report = detectDrift(events, 'default');
    expect(report.level).toBe('warning');
    expect(report.suggestion).toBeDefined();
    expect(report.suggestion!.length).toBeGreaterThan(0);
  });
});

describe('detectDrift — adjustment (5 consecutive < 0.4)', () => {
  it('returns adjustment when 5 consecutive scores below 0.4', () => {
    const events = makeEvents('default', [0.8, 0.3, 0.3, 0.3, 0.3, 0.3]);
    const report = detectDrift(events, 'default');
    expect(report.level).toBe('adjustment');
    expect(report.consecutive_low).toBe(5);
  });

  it('does NOT return adjustment for only 4 consecutive < 0.4', () => {
    const events = makeEvents('default', [0.8, 0.35, 0.35, 0.35, 0.35]);
    const report = detectDrift(events, 'default');
    // 4회 연속 < 0.4이므로 adjustment 아님, warning만 해당
    expect(report.level).toBe('warning');
  });

  it('adjustment level consecutive_low equals 5', () => {
    const events = makeEvents('default', [0.9, 0.9, 0.35, 0.35, 0.35, 0.35, 0.35]);
    const report = detectDrift(events, 'default');
    expect(report.level).toBe('adjustment');
    expect(report.consecutive_low).toBeGreaterThanOrEqual(5);
  });
});

describe('detectDrift — deactivation (7 consecutive < 0.3)', () => {
  it('returns deactivation when 7 consecutive scores below 0.3', () => {
    const events = makeEvents('default', [0.9, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25]);
    const report = detectDrift(events, 'default');
    expect(report.level).toBe('deactivation');
    expect(report.consecutive_low).toBe(7);
  });

  it('does NOT return deactivation for only 6 consecutive < 0.3', () => {
    const events = makeEvents('default', [0.9, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25]);
    const report = detectDrift(events, 'default');
    // 6회 < 0.3이면 adjustment (< 0.4도 포함)
    expect(report.level).not.toBe('deactivation');
  });

  it('deactivation has suggestion mentioning disable', () => {
    const events = makeEvents('default', [0.9, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
    const report = detectDrift(events, 'default');
    expect(report.level).toBe('deactivation');
    expect(report.suggestion).toBeDefined();
  });
});

describe('detectDrift — trend calculation', () => {
  it('returns improving trend when recent avg is much higher than previous', () => {
    // 이전 5회: 낮음, 최근 5회: 높음
    const events = makeEvents('default', [0.2, 0.2, 0.2, 0.2, 0.2, 0.9, 0.9, 0.9, 0.9, 0.9]);
    const report = detectDrift(events, 'default');
    expect(report.trend).toBe('improving');
  });

  it('returns declining trend when recent avg is much lower than previous', () => {
    // 이전 5회: 높음, 최근 5회: 낮음
    const events = makeEvents('default', [0.9, 0.9, 0.9, 0.9, 0.9, 0.4, 0.4, 0.4, 0.4, 0.4]);
    const report = detectDrift(events, 'default');
    expect(report.trend).toBe('declining');
  });

  it('returns stable trend when scores are consistent', () => {
    const events = makeEvents('default', [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7]);
    const report = detectDrift(events, 'default');
    expect(report.trend).toBe('stable');
  });

  it('avg_recent and avg_previous are calculated correctly', () => {
    const events = makeEvents('default', [0.8, 0.8, 0.8, 0.8, 0.8, 0.6, 0.6, 0.6, 0.6, 0.6]);
    const report = detectDrift(events, 'default');
    expect(report.avg_previous).toBeCloseTo(0.8, 1);
    expect(report.avg_recent).toBeCloseTo(0.6, 1);
  });

  it('handles fewer than 10 events for trend calculation', () => {
    const events = makeEvents('default', [0.8, 0.8, 0.8]);
    const report = detectDrift(events, 'default');
    expect(report.trend).toBe('stable'); // 이전 기간 없으면 stable
  });
});

describe('detectDrift — events without score', () => {
  it('ignores events without outcome.score', () => {
    const eventsNoScore = makeEvents('default', [undefined, undefined, undefined]);
    const report = detectDrift(eventsNoScore, 'default');
    expect(report.level).toBe('none');
    expect(report.consecutive_low).toBe(0);
  });

  it('mixes scored and unscored events correctly', () => {
    const scored = makeEvents('default', [0.8, 0.4, 0.4, 0.4]);
    const unscored = makeEvents('default', [undefined, undefined]);
    const events = [...scored, ...unscored];
    const report = detectDrift(events, 'default');
    expect(report.level).toBe('warning');
  });
});

describe('detectDrift — time window based', () => {
  it('triggers warning when 7-day average < 0.5 with at least 2 data points', () => {
    const now = new Date();
    const events = [
      makeEventDaysAgo('default', 0.3, 2, now),
      makeEventDaysAgo('default', 0.4, 5, now),
    ];
    const report = detectDrift(events, 'default', now);
    expect(report.level).toBe('warning');
    expect(report.time_window_triggered).toBe(true);
    expect(report.window_days).toBe(7);
    expect(report.window_avg).toBeDefined();
    expect(report.window_avg!).toBeLessThan(0.5);
  });

  it('triggers adjustment when 14-day average < 0.4 with at least 3 data points', () => {
    const now = new Date();
    const events = [
      makeEventDaysAgo('default', 0.2, 3, now),
      makeEventDaysAgo('default', 0.3, 8, now),
      makeEventDaysAgo('default', 0.35, 12, now),
    ];
    const report = detectDrift(events, 'default', now);
    expect(report.level).toBe('adjustment');
    expect(report.time_window_triggered).toBe(true);
    expect(report.window_days).toBe(14);
    expect(report.window_avg).toBeDefined();
    expect(report.window_avg!).toBeLessThan(0.4);
  });

  it('triggers deactivation when 30-day average < 0.3 with at least 4 data points', () => {
    const now = new Date();
    const events = [
      makeEventDaysAgo('default', 0.1, 5, now),
      makeEventDaysAgo('default', 0.2, 10, now),
      makeEventDaysAgo('default', 0.25, 20, now),
      makeEventDaysAgo('default', 0.15, 28, now),
    ];
    const report = detectDrift(events, 'default', now);
    expect(report.level).toBe('deactivation');
    expect(report.time_window_triggered).toBe(true);
    expect(report.window_days).toBe(30);
    expect(report.window_avg).toBeDefined();
    expect(report.window_avg!).toBeLessThan(0.3);
  });

  it('returns none when data count is below minimum threshold (insufficient data)', () => {
    const now = new Date();
    // 7일 내 1개만 존재 → 최소 2개 미달, window 트리거 없음
    // 연속 횟수도 1개뿐이라 none
    const events = [makeEventDaysAgo('default', 0.1, 3, now)];
    const report = detectDrift(events, 'default', now);
    expect(report.level).toBe('none');
    expect(report.time_window_triggered).toBe(false);
  });

  it('selects higher level when both consecutive and time window are triggered', () => {
    const now = new Date();
    // 연속 횟수: 3회 연속 < 0.5 → warning
    // 시간 윈도우: 14일 내 평균 < 0.4 → adjustment
    // 최종: adjustment (더 높은 level)
    const events = [
      makeEventDaysAgo('default', 0.35, 2, now),
      makeEventDaysAgo('default', 0.35, 5, now),
      makeEventDaysAgo('default', 0.35, 10, now),
    ];
    const report = detectDrift(events, 'default', now);
    // 14일 내 3개 평균 = 0.35 < 0.4 → adjustment via window
    expect(report.level).toBe('adjustment');
    expect(report.time_window_triggered).toBe(true);
  });
});
