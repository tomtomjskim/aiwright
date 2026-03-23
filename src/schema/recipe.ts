import { z } from 'zod';

export const RecipeEntrySchema = z.object({
  fragment: z.string().min(1),
  vars: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().default(true),
});

export type RecipeEntry = z.infer<typeof RecipeEntrySchema>;

export const RecipeSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9][a-z0-9-]*$/),
  description: z.string().min(1),
  adapter: z.string().default('generic'),
  fragments: z.array(RecipeEntrySchema).min(1),
  vars: z.record(z.string(), z.unknown()).default({}),
});

export type Recipe = z.infer<typeof RecipeSchema>;
