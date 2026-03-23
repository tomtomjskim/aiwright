import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { ScoreResultSchema, type ScoreResult } from '../schema/score.js';

const SCORES_DIR = join('.aiwright', 'scores');

function scorePath(name: string): string {
  return join(SCORES_DIR, `${name}.yaml`);
}

/**
 * Read all score history entries for a given fragment/recipe name.
 * Returns an empty array if no history file exists.
 */
export async function readHistory(name: string): Promise<ScoreResult[]> {
  const filePath = scorePath(name);

  if (!existsSync(filePath)) {
    return [];
  }

  const raw = await readFile(filePath, 'utf8');
  const parsed = yaml.load(raw);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.map((item) => ScoreResultSchema.parse(item));
}

/**
 * Append a new ScoreResult to the history file.
 * Creates the .aiwright/scores/ directory and file if they do not exist.
 */
export async function appendHistory(name: string, result: ScoreResult): Promise<void> {
  await mkdir(SCORES_DIR, { recursive: true });

  const existing = await readHistory(name);
  existing.push(result);

  const content = yaml.dump(existing, { lineWidth: 120 });
  await writeFile(scorePath(name), content, 'utf8');
}

/**
 * Return the most recent up-to-10 overall scores for a fragment/recipe.
 * Ordered oldest-first (ascending by timestamp).
 */
export async function getOverallTrend(name: string): Promise<number[]> {
  const history = await readHistory(name);

  // Sort ascending by timestamp to ensure chronological order
  const sorted = [...history].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return sorted.slice(-10).map((r) => r.overall);
}
