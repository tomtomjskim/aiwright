import { describe, it, expect } from 'vitest';
import {
  computeFTRR,
  computeDelegationMaturity,
  computeContextObesity,
  computeBehavior,
} from '../../src/intelligence/behavior.js';
import type { UsageEvent } from '../../src/schema/usage-event.js';

function makeEvent(overrides: Partial<UsageEvent> = {}): UsageEvent {
  return {
    event_id: '00000000-0000-0000-0000-000000000001',
    event_type: 'apply',
    timestamp: new Date().toISOString(),
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

// ---- FTRR ----

describe('computeFTRR', () => {
  it('returns 1.0 when all events have first_turn_resolved=true', () => {
    const events = [
      makeEvent({ outcome: { first_turn_resolved: true } }),
      makeEvent({ outcome: { first_turn_resolved: true } }),
      makeEvent({ outcome: { first_turn_resolved: true } }),
    ];
    expect(computeFTRR(events)).toBe(1.0);
  });

  it('returns 0.5 when half have first_turn_resolved=true', () => {
    const events = [
      makeEvent({ outcome: { first_turn_resolved: true } }),
      makeEvent({ outcome: { first_turn_resolved: false } }),
    ];
    expect(computeFTRR(events)).toBe(0.5);
  });

  it('returns 0 when no events have outcome with first_turn_resolved', () => {
    const events = [makeEvent(), makeEvent()];
    expect(computeFTRR(events)).toBe(0);
  });

  it('returns 0 for empty events', () => {
    expect(computeFTRR([])).toBe(0);
  });

  it('ignores events without first_turn_resolved in denominator', () => {
    const events = [
      makeEvent({ outcome: { first_turn_resolved: true } }),
      makeEvent(),  // no outcome
    ];
    // Only 1 event with first_turn_resolved, and it's true → 1.0
    expect(computeFTRR(events)).toBe(1.0);
  });
});

// ---- Delegation Maturity ----

describe('computeDelegationMaturity', () => {
  it('returns Lv1 for empty events', () => {
    expect(computeDelegationMaturity([])).toBe(1);
  });

  it('returns Lv1 when avg slot_count <= 1', () => {
    const events = [
      makeEvent({ prompt_metrics: { total_chars: 200, slot_count: 1, variable_count: 0, variable_filled: 0, has_constraint: false, has_example: false, has_context: false, sentence_count: 2, imperative_ratio: 0.2 } }),
      makeEvent({ prompt_metrics: { total_chars: 200, slot_count: 1, variable_count: 0, variable_filled: 0, has_constraint: false, has_example: false, has_context: false, sentence_count: 2, imperative_ratio: 0.2 } }),
    ];
    expect(computeDelegationMaturity(events)).toBe(1);
  });

  it('returns Lv2 when avg slot_count >= 2 but no constraint/example usage', () => {
    const events = [
      makeEvent({ prompt_metrics: { total_chars: 400, slot_count: 3, variable_count: 0, variable_filled: 0, has_constraint: false, has_example: false, has_context: false, sentence_count: 4, imperative_ratio: 0.3 } }),
      makeEvent({ prompt_metrics: { total_chars: 400, slot_count: 2, variable_count: 0, variable_filled: 0, has_constraint: false, has_example: false, has_context: false, sentence_count: 4, imperative_ratio: 0.3 } }),
    ];
    expect(computeDelegationMaturity(events)).toBe(2);
  });

  it('returns Lv3 when constraint + example 50%+ usage', () => {
    const events = [
      makeEvent({ prompt_metrics: { total_chars: 400, slot_count: 3, variable_count: 0, variable_filled: 0, has_constraint: true, has_example: true, has_context: false, sentence_count: 4, imperative_ratio: 0.3 } }),
      makeEvent({ prompt_metrics: { total_chars: 400, slot_count: 3, variable_count: 0, variable_filled: 0, has_constraint: true, has_example: true, has_context: false, sentence_count: 4, imperative_ratio: 0.3 } }),
    ];
    // constraint 100%, example 100% >= 50% → Lv3; no variable usage + imperative 0.3 not > 0.5 → not Lv4
    expect(computeDelegationMaturity(events)).toBe(3);
  });

  it('returns Lv4 when Lv3 + variable usage + imperative_ratio > 0.5', () => {
    const events = [
      makeEvent({ prompt_metrics: { total_chars: 400, slot_count: 3, variable_count: 2, variable_filled: 2, has_constraint: true, has_example: true, has_context: false, sentence_count: 4, imperative_ratio: 0.8 } }),
      makeEvent({ prompt_metrics: { total_chars: 400, slot_count: 3, variable_count: 1, variable_filled: 1, has_constraint: true, has_example: true, has_context: false, sentence_count: 4, imperative_ratio: 0.7 } }),
    ];
    expect(computeDelegationMaturity(events)).toBe(4);
  });
});

// ---- Context Obesity ----

describe('computeContextObesity', () => {
  it('returns 0 for empty events', () => {
    expect(computeContextObesity([])).toBe(0);
  });

  it('returns 0 when all events have context_chars = 0', () => {
    const events = [makeEvent(), makeEvent()];
    expect(computeContextObesity(events)).toBe(0);
  });

  it('returns 1.0 when all context events exceed 60% ratio (obese)', () => {
    // context_chars=700, total_chars=1000 → 70% > 60%
    const events = [
      makeEvent({ prompt_metrics: { total_chars: 1000, slot_count: 2, variable_count: 0, variable_filled: 0, has_constraint: false, has_example: false, has_context: true, context_chars: 700, sentence_count: 5, imperative_ratio: 0.2 } }),
      makeEvent({ prompt_metrics: { total_chars: 1000, slot_count: 2, variable_count: 0, variable_filled: 0, has_constraint: false, has_example: false, has_context: true, context_chars: 800, sentence_count: 5, imperative_ratio: 0.2 } }),
    ];
    expect(computeContextObesity(events)).toBe(1.0);
  });

  it('returns 0 when context ratio is below 60% (not obese)', () => {
    // context_chars=300, total_chars=1000 → 30% < 60%
    const events = [
      makeEvent({ prompt_metrics: { total_chars: 1000, slot_count: 3, variable_count: 1, variable_filled: 1, has_constraint: true, has_example: true, has_context: true, context_chars: 300, sentence_count: 8, imperative_ratio: 0.5 } }),
    ];
    expect(computeContextObesity(events)).toBe(0);
  });

  it('returns 0.5 for mixed case (one obese, one not)', () => {
    const events = [
      // obese: 700/1000 = 70%
      makeEvent({ prompt_metrics: { total_chars: 1000, slot_count: 2, variable_count: 0, variable_filled: 0, has_constraint: false, has_example: false, has_context: true, context_chars: 700, sentence_count: 5, imperative_ratio: 0.1 } }),
      // not obese: 400/1000 = 40%
      makeEvent({ prompt_metrics: { total_chars: 1000, slot_count: 3, variable_count: 1, variable_filled: 1, has_constraint: true, has_example: false, has_context: true, context_chars: 400, sentence_count: 5, imperative_ratio: 0.3 } }),
    ];
    expect(computeContextObesity(events)).toBe(0.5);
  });

  it('excludes events with context_chars = 0 from denominator', () => {
    // Only the event with context_chars > 0 counts; it is obese
    const events = [
      makeEvent(), // context_chars = 0 → excluded
      makeEvent({ prompt_metrics: { total_chars: 1000, slot_count: 2, variable_count: 0, variable_filled: 0, has_constraint: false, has_example: false, has_context: true, context_chars: 700, sentence_count: 5, imperative_ratio: 0.2 } }),
    ];
    expect(computeContextObesity(events)).toBe(1.0);
  });

  it('returns 0 when context_chars equals exactly 60% of total_chars (boundary, not obese)', () => {
    // 600/1000 = 0.6, not strictly > 0.6
    const events = [
      makeEvent({ prompt_metrics: { total_chars: 1000, slot_count: 2, variable_count: 0, variable_filled: 0, has_constraint: false, has_example: false, has_context: true, context_chars: 600, sentence_count: 5, imperative_ratio: 0.2 } }),
    ];
    expect(computeContextObesity(events)).toBe(0);
  });
});

// ---- computeBehavior ----

describe('computeBehavior', () => {
  it('returns BehaviorProfile with all required fields', () => {
    const events = [makeEvent({ outcome: { first_turn_resolved: true } })];
    const result = computeBehavior(events);
    expect(typeof result.ftrr).toBe('number');
    expect(typeof result.delegation_maturity).toBe('number');
    expect(typeof result.context_obesity).toBe('number');
  });

  it('returns default values for empty events', () => {
    const result = computeBehavior([]);
    expect(result.ftrr).toBe(0);
    expect(result.delegation_maturity).toBe(1);
    expect(result.context_obesity).toBe(0);
  });

  it('ftrr is within [0, 1]', () => {
    const events = [
      makeEvent({ outcome: { first_turn_resolved: true } }),
      makeEvent({ outcome: { first_turn_resolved: false } }),
    ];
    const result = computeBehavior(events);
    expect(result.ftrr).toBeGreaterThanOrEqual(0);
    expect(result.ftrr).toBeLessThanOrEqual(1);
  });

  it('delegation_maturity is within [1, 4]', () => {
    const events = [makeEvent()];
    const result = computeBehavior(events);
    expect(result.delegation_maturity).toBeGreaterThanOrEqual(1);
    expect(result.delegation_maturity).toBeLessThanOrEqual(4);
  });
});
