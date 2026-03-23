import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerStatusCommand } from '../../src/commands/status.js';

// storage mock
vi.mock('../../src/intelligence/storage.js', () => ({
  loadProfile: vi.fn(),
  loadEvents: vi.fn(),
}));

vi.mock('../../src/intelligence/drift.js', () => ({
  detectDrift: vi.fn(),
}));

import { loadProfile, loadEvents } from '../../src/intelligence/storage.js';
import { detectDrift } from '../../src/intelligence/drift.js';

function makeProfile(overrides = {}) {
  return {
    version: '1',
    user_id: 'default',
    updated_at: new Date().toISOString(),
    dna_code: 'AW-S9E0I1',
    total_events: 12,
    style: {
      verbosity: 0.42,
      specificity: 0.82,
      context_ratio: 0.5,
      constraint_usage: 0.6,
      example_usage: 0.3,
      imperative_clarity: 0.7,
    },
    weaknesses: [
      { id: 'W003', severity: 'WARN' as const, message: '프롬프트 너무 짧음', suggestion: '' },
      { id: 'W004', severity: 'INFO' as const, message: '예시 미사용', suggestion: '' },
    ],
    domains: [],
    adaptive: { enabled: false, rules: [] },
    behavior: { ftrr: 0.8, delegation_maturity: 2, context_obesity: 0.2 },
    growth: [],
    ...overrides,
  };
}

async function runStatus(args: string[] = []) {
  const program = new Command();
  program.exitOverride();
  registerStatusCommand(program);
  await program.parseAsync(['node', 'test', 'status', ...args]);
}

describe('status command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(loadEvents).mockResolvedValue([]);
    vi.mocked(detectDrift).mockReturnValue({
      recipe: 'default',
      level: 'none',
      consecutive_low: 0,
      avg_recent: 0.82,
      avg_previous: 0,
      trend: 'stable',
      message: 'OK',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Run aiwright apply first" when no profile', async () => {
    vi.mocked(loadProfile).mockResolvedValue(null);

    await runStatus();

    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('Run `aiwright apply` first');
  });

  it('shows DNA code when profile exists', async () => {
    vi.mocked(loadProfile).mockResolvedValue(makeProfile());

    await runStatus();

    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('AW-S9E0I1');
  });

  it('shows Events count when profile exists', async () => {
    vi.mocked(loadProfile).mockResolvedValue(makeProfile({ total_events: 12 }));

    await runStatus();

    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('12');
  });

  it('shows Style Profile section', async () => {
    vi.mocked(loadProfile).mockResolvedValue(makeProfile());

    await runStatus();

    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('Style Profile');
  });

  it('shows Weaknesses section with count', async () => {
    vi.mocked(loadProfile).mockResolvedValue(makeProfile());

    await runStatus();

    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('Weaknesses');
    expect(allOutput).toContain('W003');
  });

  it('shows Drift status when events exist', async () => {
    vi.mocked(loadProfile).mockResolvedValue(makeProfile());
    vi.mocked(loadEvents).mockResolvedValue([
      {
        event_id: 'evt-1',
        event_type: 'apply',
        timestamp: new Date().toISOString(),
        recipe: 'default',
        fragments: [],
        adapter: 'claude-code',
        domain_tags: [],
        prompt_metrics: {
          total_chars: 500,
          section_count: 3,
          has_system: true,
          has_context: false,
          has_constraint: true,
          has_example: false,
          variable_count: 0,
          variable_filled: 0,
          imperative_ratio: 0.5,
        },
      },
    ]);

    await runStatus();

    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('Drift');
  });

  it('shows separator lines', async () => {
    vi.mocked(loadProfile).mockResolvedValue(makeProfile());

    await runStatus();

    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('═');
  });

  it('shows "No significant weaknesses" when weaknesses array is empty', async () => {
    vi.mocked(loadProfile).mockResolvedValue(makeProfile({ weaknesses: [] }));

    await runStatus();

    const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
    expect(allOutput).toContain('No significant weaknesses');
  });
});
