import { z } from 'zod';

/**
 * Profile: 여러 Recipe를 묶는 상위 단위
 * Phase 2 CLI용. MVP에서는 스키마 정의만 포함하여 향후 호환성 확보.
 */
export const ProfileSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
  description: z.string().min(1),
  recipes: z.array(z.string()).min(1),  // Recipe name 목록
  default_recipe: z.string().optional(), // 기본 적용 Recipe
});
export type Profile = z.infer<typeof ProfileSchema>;
