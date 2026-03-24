import { describe, it, expect } from 'vitest';
import { computeGrowth } from '../../src/intelligence/growth.js';
import type { UsageEvent } from '../../src/schema/usage-event.js';

function makeEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    event_id: '00000000-0000-0000-0000-000000000001',
    event_type: 'apply',
    timestamp: '2024-01-15T00:00:00.000Z',
    recipe: 'test-recipe',
    fragments: [],
    adapter: 'generic',
    domain_tags: [],
    prompt_metrics: {
      total_chars: 500,
      slot_count: 2,
      variable_count: 0,
      variable_filled: 0,
      has_constraint: false,
      has_example: false,
      has_context: false,
      context_chars: 0,
      sentence_count: 4,
      imperative_ratio: 0.5,
    },
    ...overrides,
  };
}

describe('computeGrowth', () => {
  it('빈 이벤트 배열이면 빈 배열 반환', () => {
    const result = computeGrowth([]);
    expect(result).toEqual([]);
  });

  it('단일 월 이벤트 — 스냅샷 1개 반환', () => {
    const events = [
      makeEvent({ timestamp: '2024-01-10T00:00:00.000Z' }),
      makeEvent({ timestamp: '2024-01-20T00:00:00.000Z' }),
    ];

    const result = computeGrowth(events);
    expect(result).toHaveLength(1);
    expect(result[0].period).toBe('2024-01');
    expect(result[0].event_count).toBe(2);
  });

  it('다른 월 이벤트 — 각각 별도 스냅샷 반환', () => {
    const events = [
      makeEvent({ timestamp: '2024-01-15T00:00:00.000Z' }),
      makeEvent({ timestamp: '2024-02-15T00:00:00.000Z' }),
      makeEvent({ timestamp: '2024-03-15T00:00:00.000Z' }),
    ];

    const result = computeGrowth(events);
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.period)).toEqual(['2024-01', '2024-02', '2024-03']);
  });

  it('월별 스냅샷이 오름차순(YYYY-MM)으로 정렬', () => {
    // 역순 입력
    const events = [
      makeEvent({ timestamp: '2024-03-15T00:00:00.000Z' }),
      makeEvent({ timestamp: '2024-01-15T00:00:00.000Z' }),
      makeEvent({ timestamp: '2024-02-15T00:00:00.000Z' }),
    ];

    const result = computeGrowth(events);
    expect(result[0].period).toBe('2024-01');
    expect(result[1].period).toBe('2024-02');
    expect(result[2].period).toBe('2024-03');
  });

  it('outcome.score가 있는 이벤트로 overall_score 평균 계산', () => {
    const events = [
      makeEvent({
        timestamp: '2024-01-10T00:00:00.000Z',
        outcome: { score: 0.8 },
      }),
      makeEvent({
        timestamp: '2024-01-20T00:00:00.000Z',
        outcome: { score: 0.6 },
      }),
    ];

    const result = computeGrowth(events);
    expect(result[0].overall_score).toBeCloseTo(0.7, 5);
  });

  it('outcome.score 없으면 overall_score = 0', () => {
    const events = [
      makeEvent({ timestamp: '2024-01-10T00:00:00.000Z' }),
    ];

    const result = computeGrowth(events);
    expect(result[0].overall_score).toBe(0);
  });

  it('일부 이벤트만 score 있을 때 score 있는 것만 평균', () => {
    const events = [
      makeEvent({ timestamp: '2024-01-10T00:00:00.000Z', outcome: { score: 0.9 } }),
      makeEvent({ timestamp: '2024-01-15T00:00:00.000Z' }), // score 없음
    ];

    const result = computeGrowth(events);
    // score 있는 1개만으로 평균 = 0.9
    expect(result[0].overall_score).toBeCloseTo(0.9, 5);
  });

  it('각 스냅샷에 style 속성 포함', () => {
    const events = [makeEvent({ timestamp: '2024-01-15T00:00:00.000Z' })];

    const result = computeGrowth(events);
    expect(result[0].style).toBeDefined();
    expect(typeof result[0].style.verbosity).toBe('number');
  });

  it('event_count가 월별 이벤트 수와 일치', () => {
    const events = [
      makeEvent({ timestamp: '2024-01-01T00:00:00.000Z' }),
      makeEvent({ timestamp: '2024-01-10T00:00:00.000Z' }),
      makeEvent({ timestamp: '2024-01-20T00:00:00.000Z' }),
      makeEvent({ timestamp: '2024-02-01T00:00:00.000Z' }),
    ];

    const result = computeGrowth(events);
    expect(result[0].event_count).toBe(3); // Jan
    expect(result[1].event_count).toBe(1); // Feb
  });

  it('연도가 다른 동일 월은 별도 스냅샷', () => {
    const events = [
      makeEvent({ timestamp: '2023-01-15T00:00:00.000Z' }),
      makeEvent({ timestamp: '2024-01-15T00:00:00.000Z' }),
    ];

    const result = computeGrowth(events);
    expect(result).toHaveLength(2);
    expect(result[0].period).toBe('2023-01');
    expect(result[1].period).toBe('2024-01');
  });
});
