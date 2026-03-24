import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerScoreCommand } from '../../src/commands/score.js';

vi.mock('../../src/scoring/user-signal.js', () => ({
  recordScore: vi.fn(),
}));

vi.mock('../../src/scoring/history.js', () => ({
  readHistory: vi.fn(),
  getOverallTrend: vi.fn(),
}));

vi.mock('../../src/intelligence/storage.js', () => ({
  recordUsageEvent: vi.fn(),
}));

import { recordScore } from '../../src/scoring/user-signal.js';
import { readHistory, getOverallTrend } from '../../src/scoring/history.js';

function makeScoreResult(overrides = {}) {
  return {
    fragment_or_recipe: 'my-recipe',
    timestamp: '2024-01-01T00:00:00.000Z',
    metrics: [{ name: 'user_rating', value: 0.9, source: 'user' as const, rationale: 'good' }],
    overall: 0.9,
    adapter: 'claude-code',
    ...overrides,
  };
}

async function runScore(args: string[]) {
  const program = new Command();
  program.exitOverride();
  registerScoreCommand(program);
  await program.parseAsync(['node', 'test', 'score', ...args]);
}

describe('score command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('--format text (default)', () => {
    it('shows text output when recording a score', async () => {
      vi.mocked(recordScore).mockResolvedValue(makeScoreResult());

      await runScore(['my-recipe', '--set', '0.9']);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
      expect(allOutput).toContain('Recorded score for');
      expect(allOutput).toContain('my-recipe');
    });

    it('shows text history listing', async () => {
      vi.mocked(readHistory).mockResolvedValue([makeScoreResult()]);

      await runScore(['my-recipe']);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
      expect(allOutput).toContain('Score history');
    });
  });

  describe('--format json', () => {
    it('outputs JSON when --set with --format json', async () => {
      vi.mocked(recordScore).mockResolvedValue(makeScoreResult());

      await runScore(['my-recipe', '--set', '0.9', '--format', 'json']);

      const raw = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(raw) as { recorded: boolean; name: string; value: number; timestamp: string };
      expect(parsed.recorded).toBe(true);
      expect(parsed.name).toBe('my-recipe');
      expect(parsed.value).toBe(0.9);
      expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('outputs JSON array for history with --format json', async () => {
      vi.mocked(readHistory).mockResolvedValue([makeScoreResult()]);

      await runScore(['my-recipe', '--format', 'json']);

      const raw = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(raw) as Array<{ name: string; value: number; timestamp: string; note: string | null; adapter: string | null }>;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].name).toBe('my-recipe');
      expect(parsed[0].value).toBe(0.9);
      expect(parsed[0].timestamp).toBe('2024-01-01T00:00:00.000Z');
      expect(parsed[0].note).toBe('good');
      expect(parsed[0].adapter).toBe('claude-code');
    });

    it('outputs empty JSON array when no history', async () => {
      vi.mocked(readHistory).mockResolvedValue([]);

      await runScore(['my-recipe', '--format', 'json']);

      const raw = consoleLogSpy.mock.calls[0][0] as string;
      const parsed = JSON.parse(raw) as unknown[];
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(0);
    });

    it('does not output chalk-colored text when --format json', async () => {
      vi.mocked(recordScore).mockResolvedValue(makeScoreResult());

      await runScore(['my-recipe', '--set', '0.9', '--format', 'json']);

      const raw = consoleLogSpy.mock.calls[0][0] as string;
      // Must be valid JSON — chalk ANSI codes would break this
      expect(() => JSON.parse(raw)).not.toThrow();
    });
  });
});
