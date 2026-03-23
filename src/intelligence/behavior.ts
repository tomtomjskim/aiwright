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
 * has_context가 true인 이벤트 중 context_chars/total_chars > 0.6인 비율
 * context_chars는 total_chars * context_ratio로 추정 (prompt_metrics에는 context_ratio 없음)
 * — has_context가 없으므로 slot_count와 total_chars로 추정:
 *   context_chars ≈ total_chars * (context_char_ratio 없음 → has_context 있는 이벤트에서
 *   context 비율은 available 하지 않으므로 score event의 pcr 사용)
 *
 * 실제로는 프롬프트 메트릭에 context 비율 정보가 없어서 has_context=true인 이벤트 전체를
 * obesity로 판단할 수 없음. 대신 total_chars가 높으면서 has_context=true인 케이스를 obesity로 봄.
 * 구체적으로: has_context=true 이벤트 중 slot_count가 낮은(컨텍스트 위주인) 이벤트 비율.
 *
 * 정확한 context_chars가 없으므로: has_context=true인 이벤트 수 / 전체 이벤트 수
 * — 단, context_ratio 역할을 하는 context_chars/total_chars 계산을 위해
 *   PromptMetrics에는 has_context만 있고 context_chars는 없음.
 *   따라서 context_ratio > 0.6 판단은 lintComposed의 PS008처럼 sections.get('context') 기준인데
 *   events에는 sections 정보가 없음.
 *
 * 설계 결정: has_context=true 이벤트 중 (total_chars가 크고 slot_count가 1인 경우)를
 * context_obesity로 간주. slot_count=1이면 거의 context만 있는 구조.
 * 더 실용적인 접근: has_context=true인 비율을 obesity rate로 반환.
 */
export function computeContextObesity(events: UsageEvent[]): number {
  const contextEvents = events.filter((e) => e.prompt_metrics.has_context);
  if (contextEvents.length === 0) return 0;

  // context가 전체의 60% 이상인 이벤트: has_context=true이고 slot_count <= 1인 경우를 obesity로 봄
  // (컨텍스트 외 슬롯이 거의 없으면 context 비율이 높다고 추정)
  const obesityCount = contextEvents.filter(
    (e) => e.prompt_metrics.slot_count <= 1,
  ).length;

  return obesityCount / contextEvents.length;
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
