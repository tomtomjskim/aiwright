import { type UsageEvent } from '../schema/usage-event.js';
import { type BehaviorProfile } from '../schema/user-profile.js';

/**
 * FTRR: First-Turn Resolution Rate
 * outcome.first_turn_resolved가 true인 비율
 */
export function computeFTRR(events: UsageEvent[]): number {
  const withOutcome = events.filter((e) => e.outcome?.first_turn_resolved !== undefined);
  if (withOutcome.length === 0) return 0;
  return withOutcome.filter((e) => e.outcome?.first_turn_resolved === true).length / withOutcome.length;
}

/**
 * Delegation Maturity: 1~4 레벨 판정
 * Lv1: avg slot_count <= 1
 * Lv2: avg slot_count >= 2
 * Lv3: constraint + example 50%+ 사용
 * Lv4: Lv3 + variable 활용 + imperative_ratio > 0.5
 */
export function computeDelegationMaturity(events: UsageEvent[]): number {
  if (events.length === 0) return 1;

  const n = events.length;

  const avgSlotCount = events.reduce((s, e) => s + e.prompt_metrics.slot_count, 0) / n;

  const constraintRate = events.filter((e) => e.prompt_metrics.has_constraint).length / n;
  const exampleRate = events.filter((e) => e.prompt_metrics.has_example).length / n;

  const variableUsageRate = events.filter((e) => e.prompt_metrics.variable_count > 0).length / n;
  const avgImperativeRatio = events.reduce((s, e) => s + e.prompt_metrics.imperative_ratio, 0) / n;

  // Lv4: Lv3 조건 + variable 활용 + imperative_ratio > 0.5
  const lv3Condition = constraintRate >= 0.5 && exampleRate >= 0.5;
  if (lv3Condition && variableUsageRate > 0 && avgImperativeRatio > 0.5) {
    return 4;
  }

  // Lv3: constraint + example 50%+ 사용
  if (lv3Condition) {
    return 3;
  }

  // Lv2: avg slot_count >= 2
  if (avgSlotCount >= 2) {
    return 2;
  }

  // Lv1: 기본
  return 1;
}

/**
 * Context Obesity Rate:
 * context_chars / total_chars > 0.6인 이벤트 비율
 * context_chars = 0인 이벤트는 계산에서 제외
 */
export function computeContextObesity(events: UsageEvent[]): number {
  const withContext = events.filter((e) => e.prompt_metrics.context_chars > 0);
  if (withContext.length === 0) return 0;
  const obeseCount = withContext.filter(
    (e) => e.prompt_metrics.context_chars / e.prompt_metrics.total_chars > 0.6,
  ).length;
  return obeseCount / withContext.length;
}

/**
 * 3축 BehaviorProfile 집계
 */
export function computeBehavior(events: UsageEvent[]): BehaviorProfile {
  return {
    ftrr: computeFTRR(events),
    delegation_maturity: computeDelegationMaturity(events),
    context_obesity: computeContextObesity(events),
  };
}
