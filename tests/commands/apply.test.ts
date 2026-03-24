import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { Command } from 'commander';
import { registerApplyCommand } from '../../src/commands/apply.js';

// ── 무거운 intelligence 모듈 모킹 ─────────────────────────────────────────

vi.mock('../../src/intelligence/storage.js', () => ({
  loadProfile: vi.fn(() => Promise.resolve(null)),
  loadEvents: vi.fn(() => Promise.resolve([])),
  saveProfile: vi.fn(() => Promise.resolve(undefined)),
  recordUsageEvent: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('../../src/intelligence/adapt.js', () => ({
  adaptFragments: vi.fn((entries: unknown[]) => ({
    entries,
    actions: [],
  })),
}));

vi.mock('../../src/intelligence/git-trace.js', () => ({
  addGitNote: vi.fn(() => Promise.resolve(undefined)),
}));

vi.mock('../../src/intelligence/auto-score.js', () => ({
  computeAutoScore: vi.fn(() =>
    Promise.resolve({
      heuristic: 0.7,
      judge: 0.0,
      final: 0.7,
      model: 'none',
      tip: null,
    }),
  ),
}));

vi.mock('../../src/intelligence/compact-summary.js', () => ({
  printCompactSummary: vi.fn(),
}));

vi.mock('../../src/intelligence/profiler.js', () => ({
  computeStyle: vi.fn(() => ({
    verbosity: 0.5,
    specificity: 0.5,
    context_ratio: 0.3,
    constraint_usage: 0.1,
    example_usage: 0.0,
    imperative_clarity: 0.2,
  })),
  generateDnaCode: vi.fn(() => 'AW-T0E0S0'),
  aggregateDomains: vi.fn(() => []),
}));

vi.mock('../../src/intelligence/diagnose.js', () => ({
  diagnoseWeaknesses: vi.fn(() => []),
}));

vi.mock('../../src/intelligence/behavior.js', () => ({
  computeBehavior: vi.fn(() => ({
    ftrr: 0.5,
    delegation_maturity: 1,
    context_obesity: 0.3,
  })),
}));

vi.mock('../../src/intelligence/growth.js', () => ({
  computeGrowth: vi.fn(() => []),
}));

// ── 헬퍼 ─────────────────────────────────────────────────────────────────

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-apply-test-'));
}

/** tmpDir에 aiwright.config.yaml + 로컬 fragment 파일을 생성 */
async function setupProject(
  tmpDir: string,
  opts: {
    recipeName?: string;
    fragmentName?: string;
    adapter?: string;
  } = {},
): Promise<void> {
  const recipeName = opts.recipeName ?? 'default';
  const fragmentName = opts.fragmentName ?? 'test-frag';
  const adapter = opts.adapter ?? 'generic';

  // claude-code 어댑터일 때 .claude/ 디렉토리 생성 (detectAdapter가 감지하도록)
  if (adapter === 'claude-code') {
    await fs.mkdir(path.join(tmpDir, '.claude'), { recursive: true });
  }

  // fragment 파일 생성
  const fragmentsDir = path.join(tmpDir, '.aiwright', 'fragments');
  await fs.mkdir(fragmentsDir, { recursive: true });
  const fragmentContent = `---
name: ${fragmentName}
version: 1.0.0
description: Test fragment
slot: system
priority: 10
---
You are a helpful test assistant.
`;
  await fs.writeFile(path.join(fragmentsDir, `${fragmentName}.md`), fragmentContent, 'utf-8');

  // config 생성
  const configContent = `version: '1'
adapter: ${adapter}

recipes:
  ${recipeName}:
    description: Test recipe
    fragments:
      - fragment: ${fragmentName}
`;
  await fs.writeFile(path.join(tmpDir, 'aiwright.config.yaml'), configContent, 'utf-8');
}

async function runApply(args: string[], cwd: string): Promise<void> {
  const origCwd = process.cwd;
  process.cwd = () => cwd;

  const program = new Command();
  program.exitOverride();
  registerApplyCommand(program);

  try {
    await program.parseAsync(['node', 'aiwright', 'apply', ...args]);
  } finally {
    process.cwd = origCwd;
  }
}

// ── 테스트 ─────────────────────────────────────────────────────────────────

describe('apply command', () => {
  let tmpDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── 정상 경로 ────────────────────────────────────────────────────────────

  describe('정상 경로', () => {
    it('generic 어댑터로 apply 시 출력 파일이 생성되지 않고 성공한다', async () => {
      await setupProject(tmpDir, { adapter: 'generic' });

      // generic 어댑터는 stdout으로만 출력하고 파일을 만들지 않음
      await expect(runApply(['default'], tmpDir)).resolves.not.toThrow();
    });

    it('claude-code 어댑터로 apply 시 .claude/CLAUDE.md가 생성된다', async () => {
      await setupProject(tmpDir, { adapter: 'claude-code' });

      await runApply(['default'], tmpDir);

      const outputPath = path.join(tmpDir, '.claude', 'CLAUDE.md');
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('claude-code 어댑터 출력 파일에 fragment 내용이 포함된다', async () => {
      await setupProject(tmpDir, { adapter: 'claude-code' });

      await runApply(['default'], tmpDir);

      const outputPath = path.join(tmpDir, '.claude', 'CLAUDE.md');
      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('helpful test assistant');
    });

    it('--adapter 옵션으로 어댑터를 명시적으로 지정할 수 있다', async () => {
      await setupProject(tmpDir, { adapter: 'generic' });

      await expect(
        runApply(['default', '--adapter', 'claude-code'], tmpDir),
      ).resolves.not.toThrow();

      const outputPath = path.join(tmpDir, '.claude', 'CLAUDE.md');
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('manifest 파일이 생성된다', async () => {
      await setupProject(tmpDir, { adapter: 'claude-code' });

      await runApply(['default'], tmpDir);

      const manifestPath = path.join(tmpDir, '.aiwright', 'manifest.yaml');
      const exists = await fs.access(manifestPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  // ── --dry-run ────────────────────────────────────────────────────────────

  describe('--dry-run', () => {
    it('--dry-run 시 파일이 생성되지 않는다', async () => {
      await setupProject(tmpDir, { adapter: 'claude-code' });

      await runApply(['default', '--dry-run'], tmpDir);

      const outputPath = path.join(tmpDir, '.claude', 'CLAUDE.md');
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('--dry-run 시 Dry Run 헤더가 출력된다', async () => {
      await setupProject(tmpDir, { adapter: 'claude-code' });

      await runApply(['default', '--dry-run'], tmpDir);

      const allOutput = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allOutput).toContain('Dry Run');
    });

    it('--dry-run 시 fragment 내용이 출력에 포함된다', async () => {
      await setupProject(tmpDir, { adapter: 'claude-code' });

      await runApply(['default', '--dry-run'], tmpDir);

      const allOutput = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allOutput).toContain('helpful test assistant');
    });
  });

  // ── --diff ───────────────────────────────────────────────────────────────

  describe('--diff', () => {
    it('--diff 시 Diff 헤더가 출력된다', async () => {
      await setupProject(tmpDir, { adapter: 'claude-code' });

      await runApply(['default', '--diff'], tmpDir);

      const allOutput = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allOutput).toContain('Diff');
    });

    it('--diff 후에도 파일이 생성된다', async () => {
      await setupProject(tmpDir, { adapter: 'claude-code' });

      await runApply(['default', '--diff'], tmpDir);

      const outputPath = path.join(tmpDir, '.claude', 'CLAUDE.md');
      const exists = await fs.access(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  // ── 오류 경로 ────────────────────────────────────────────────────────────

  describe('오류 경로', () => {
    it('config 파일 없으면 ConfigNotFoundError를 던진다', async () => {
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-empty-'));
      try {
        await expect(runApply(['default'], emptyDir)).rejects.toThrow('aiwright.config.yaml not found');
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });

    it('존재하지 않는 recipe 이름이면 RecipeNotFoundError를 던진다', async () => {
      await setupProject(tmpDir);

      await expect(runApply(['nonexistent-recipe'], tmpDir)).rejects.toThrow(
        'Recipe "nonexistent-recipe" not found',
      );
    });

    it('잘못된 adapter 이름이면 AdapterNotFoundError를 던진다', async () => {
      await setupProject(tmpDir);

      await expect(
        runApply(['default', '--adapter', 'invalid-adapter-xyz'], tmpDir),
      ).rejects.toThrow();
    });
  });

  // ── 경계 조건 ────────────────────────────────────────────────────────────

  describe('경계 조건', () => {
    it('--quiet 플래그 지정 시 경고 출력 없이 실행된다', async () => {
      await setupProject(tmpDir, { adapter: 'claude-code' });

      await runApply(['default', '--quiet'], tmpDir);

      // quiet 모드에서는 경고가 억제됨
      expect(consoleWarnSpy.mock.calls.length).toBe(0);
    });

    it('두 번 연속 apply 해도 파일이 정상 덮어써진다', async () => {
      await setupProject(tmpDir, { adapter: 'claude-code' });

      await runApply(['default'], tmpDir);
      await runApply(['default'], tmpDir);

      const outputPath = path.join(tmpDir, '.claude', 'CLAUDE.md');
      const content = await fs.readFile(outputPath, 'utf-8');
      expect(content).toContain('helpful test assistant');
    });
  });
});
