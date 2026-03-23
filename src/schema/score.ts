import { z } from 'zod';

/**
 * 근거:
 * - LLM-as-Judge (arXiv:2411.15594): rationale 필드
 * - TextGrad (Nature 2024): diagnosis 필드
 * - OPRO (ICLR 2024): 이력 누적 패턴
 */
export const MetricValueSchema = z.object({
  name: z.string(),
  value: z.number().min(0).max(1),
  source: z.enum(['user', 'heuristic', 'llm-judge']),
  rationale: z.string().optional(),
});

export type MetricValue = z.infer<typeof MetricValueSchema>;

export const ScoreResultSchema = z.object({
  fragment_or_recipe: z.string(),
  timestamp: z.string().datetime(),
  metrics: z.array(MetricValueSchema),
  overall: z.number().min(0).max(1),
  diagnosis: z.string().optional(),
  model: z.string().optional(),
  adapter: z.string().optional(),
});

export type ScoreResult = z.infer<typeof ScoreResultSchema>;

export const ScoreFileSchema = z.array(ScoreResultSchema);
export type ScoreFile = z.infer<typeof ScoreFileSchema>;
