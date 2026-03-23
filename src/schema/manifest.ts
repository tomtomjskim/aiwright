import { z } from 'zod';

export const ApplyRecordSchema = z.object({
  recipe: z.string(),
  adapter: z.string(),
  applied_at: z.string().datetime(),
  fragments_applied: z.array(z.string()),
  output_hash: z.string(),
  output_path: z.string(),
});

export type ApplyRecord = z.infer<typeof ApplyRecordSchema>;

export const ApplyManifestSchema = z.object({
  version: z.literal('1'),
  project: z.string().optional(),
  history: z.array(ApplyRecordSchema),
});

export type ApplyManifest = z.infer<typeof ApplyManifestSchema>;
