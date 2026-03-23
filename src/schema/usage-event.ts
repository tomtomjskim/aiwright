import { z } from 'zod';

/**
 * 프롬프트 정적 메트릭 (LLM 호출 없이 분석)
 */
export const PromptMetricsSchema = z.object({
  total_chars: z.number().int().min(0),
  slot_count: z.number().int().min(0),
  has_constraint: z.boolean(),
  has_example: z.boolean(),
  has_context: z.boolean(),
  variable_count: z.number().int().min(0),
  variable_filled: z.number().int().min(0),
  sentence_count: z.number().int().min(0),
  imperative_ratio: z.number().min(0).max(1),
});

export type PromptMetrics = z.infer<typeof PromptMetricsSchema>;

/**
 * 결과 메트릭 (사용자가 기록한 outcome)
 */
export const OutcomeMetricsSchema = z.object({
  score: z.number().min(0).max(1).optional(),
  pcr: z.number().min(0).optional(),
  first_turn_resolved: z.boolean().optional(),
  total_tokens: z.number().int().min(0).optional(),
  turn_count: z.number().int().min(0).optional(),
});

export type OutcomeMetrics = z.infer<typeof OutcomeMetricsSchema>;

/**
 * UsageEvent: aiwright 커맨드 실행 시 기록되는 이벤트
 * 프롬프트 원문 저장 없음 (메트릭 숫자만) — 프라이버시 보호
 */
export const UsageEventSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.enum(['apply', 'score', 'bench', 'lint']),
  timestamp: z.string().datetime(),
  recipe: z.string(),
  fragments: z.array(z.string()).default([]),
  adapter: z.string().default('generic'),
  domain_tags: z.array(z.string()).default([]),
  prompt_metrics: PromptMetricsSchema,
  outcome: OutcomeMetricsSchema.optional(),
});

export type UsageEvent = z.infer<typeof UsageEventSchema>;
