import { ScoreResultSchema, type ScoreResult } from '../schema/score.js';
import { appendHistory } from './history.js';

export interface RecordScoreOptions {
  name: string;
  value: number;
  note?: string;
  adapter?: string;
}

/**
 * Record a user-provided score for a fragment or recipe.
 * Validates 0-1 range, constructs ScoreResult, and appends to
 * .aiwright/scores/<name>.yaml.
 */
export async function recordScore(opts: RecordScoreOptions): Promise<ScoreResult> {
  const { name, value, note, adapter } = opts;
  if (value < 0 || value > 1) {
    throw new RangeError(`Score value must be between 0 and 1, got ${value}`);
  }

  const result = ScoreResultSchema.parse({
    fragment_or_recipe: name,
    timestamp: new Date().toISOString(),
    metrics: [
      {
        name: 'user_rating',
        value,
        source: 'user' as const,
        rationale: note,
      },
    ],
    overall: value,
    adapter,
  });

  await appendHistory(name, result);

  return result;
}
