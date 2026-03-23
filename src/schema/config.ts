import { z } from 'zod';
import { RecipeSchema } from './recipe.js';

export const ProjectConfigSchema = z.object({
  version: z.literal('1'),
  adapter: z.string().default('claude-code'),
  vars: z.record(z.string(), z.unknown()).default({}),
  paths: z
    .object({
      local: z.string().default('.aiwright/fragments'),
    })
    .default({}),
  recipes: z.record(z.string(), RecipeSchema.omit({ name: true })).default({}),
  hooks: z
    .object({
      auto_score: z.boolean().default(true),
      auto_profile: z.boolean().default(true),
      git_note: z.boolean().default(true),
    })
    .default({}),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
