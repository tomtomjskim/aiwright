import { z } from 'zod';

/**
 * 6축 PromptStyle: 프롬프트 구조 분석 (Phase 2a)
 * 각 축은 0~1 범위, 측정 방법은 design doc 참조
 */
export const PromptStyleSchema = z.object({
  verbosity: z.number().min(0).max(1).default(0),
  specificity: z.number().min(0).max(1).default(0),
  context_ratio: z.number().min(0).max(1).default(0),
  constraint_usage: z.number().min(0).max(1).default(0),
  example_usage: z.number().min(0).max(1).default(0),
  imperative_clarity: z.number().min(0).max(1).default(0),
});

export type PromptStyle = z.infer<typeof PromptStyleSchema>;

/**
 * 3축 BehaviorProfile: 사용 행태 분석 (Phase 2b)
 */
export const BehaviorProfileSchema = z.object({
  ftrr: z.number().min(0).max(1).default(0),
  delegation_maturity: z.number().min(1).max(4).default(1),
  context_obesity: z.number().min(0).max(1).default(0),
});

export type BehaviorProfile = z.infer<typeof BehaviorProfileSchema>;

/**
 * 약점 진단 결과
 */
export const WeaknessSchema = z.object({
  id: z.string(),
  severity: z.enum(['HIGH', 'WARN', 'INFO']),
  message: z.string(),
  suggestion: z.string().optional(),
  fragment: z.string().optional(),
});

export type Weakness = z.infer<typeof WeaknessSchema>;

/**
 * 도메인별 통계
 */
export const DomainStatsSchema = z.object({
  domain: z.string(),
  total_events: z.number().int().min(0).default(0),
  avg_score: z.number().min(0).max(1).default(0),
  ftrr: z.number().min(0).max(1).default(0),
  avg_pcr: z.number().min(0).default(0),
});

export type DomainStats = z.infer<typeof DomainStatsSchema>;

/**
 * 성장 스냅샷 (시계열)
 */
export const GrowthSnapshotSchema = z.object({
  period: z.string(),
  style: PromptStyleSchema,
  overall_score: z.number().min(0).max(1).default(0),
  event_count: z.number().int().min(0).default(0),
});

export type GrowthSnapshot = z.infer<typeof GrowthSnapshotSchema>;

/**
 * 적응형 설정 (Phase 2b)
 */
export const AdaptiveConfigSchema = z.object({
  enabled: z.boolean().default(false),
  rules: z
    .array(
      z.object({
        when: z.string(),
        inject: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
});

export type AdaptiveConfig = z.infer<typeof AdaptiveConfigSchema>;

/**
 * UserProfile: 사용자 AI 활용 프로파일 전체
 */
export const UserProfileSchema = z.object({
  version: z.literal('1'),
  user_id: z.string(),
  updated_at: z.string().datetime(),
  style: PromptStyleSchema,
  dna_code: z.string(),
  weaknesses: z.array(WeaknessSchema).default([]),
  domains: z.array(DomainStatsSchema).default([]),
  adaptive: AdaptiveConfigSchema,
  behavior: BehaviorProfileSchema.optional(),
  growth: z.array(GrowthSnapshotSchema).default([]),
  total_events: z.number().int().min(0).default(0),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
