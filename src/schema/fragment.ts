import { z } from 'zod';

/**
 * Slot: 프롬프트 내 삽입 위치
 * 근거: MPO (arXiv:2601.04055) — 구조화된 섹션별 독립 최적화
 */
export const SlotEnum = z.enum([
  'system',
  'context',
  'instruction',
  'constraint',
  'output',
  'example',
  'custom',
]);

export type Slot = z.infer<typeof SlotEnum>;

export const FragmentSchema = z.object({
  // ---- 식별 ----
  name: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/).default('0.1.0'),
  description: z.string().min(1),

  // ---- 분류 ----
  tags: z.array(z.string()).default([]),
  model_hint: z.array(z.string()).default([]),

  // ---- 합성 제어 ----
  slot: SlotEnum.default('instruction'),
  slot_name: z.string().optional(),
  priority: z.number().int().min(0).max(999).default(50),

  // ---- 의존성/충돌 ----
  depends_on: z.array(z.string()).default([]),
  conflicts_with: z.array(z.string()).default([]),

  // ---- 변수 ----
  variables: z
    .record(
      z.string(),
      z.object({
        type: z.enum(['string', 'number', 'boolean']).default('string'),
        required: z.boolean().default(false),
        default: z.unknown().optional(),
        description: z.string().optional(),
      }),
    )
    .default({}),
});

export type Fragment = z.infer<typeof FragmentSchema>;

export const FragmentFileSchema = z.object({
  meta: FragmentSchema,
  body: z.string().min(1),
});

export type FragmentFile = z.infer<typeof FragmentFileSchema>;
