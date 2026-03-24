import { z } from 'zod';
import { RecipeSchema, RecipeEntrySchema } from './recipe.js';

export const JudgeConfigSchema = z.object({
  mode: z.enum(['heuristic', 'llm', 'hybrid']).default('heuristic'),
  provider: z.enum(['anthropic', 'openai']).default('anthropic'),
  model: z.string().default('claude-haiku-4-5-20251001'),
  api_key_env: z.string().default('ANTHROPIC_API_KEY'),
  cache: z.boolean().default(true),
  cache_ttl_hours: z.number().int().min(1).default(168),
  timeout_ms: z.number().int().min(1000).max(120000).default(30000),
  daily_limit: z.number().int().min(0).default(50),
  monthly_limit: z.number().int().min(0).default(500),
}).default({});

export type JudgeConfig = z.infer<typeof JudgeConfigSchema>;

export const ProjectConfigSchema = z.object({
  version: z.literal('1'),
  adapter: z.string().default('claude-code'),
  vars: z.record(z.string(), z.unknown()).default({}),
  paths: z
    .object({
      local: z.string().default('.aiwright/fragments'),
    })
    .default({}),
  recipes: z
    .record(
      z.string(),
      RecipeSchema.omit({ name: true }).extend({
        fragments: z.array(RecipeEntrySchema).default([]),
      }),
    )
    .default({}),
  hooks: z
    .object({
      auto_score: z.boolean().default(true),
      auto_profile: z.boolean().default(true),
      git_note: z.boolean().default(true),
    })
    .default({}),
  judge: JudgeConfigSchema,
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
