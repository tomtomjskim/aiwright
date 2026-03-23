import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { Command } from 'commander';
import { registerHooksCommand } from '../../src/commands/hooks.js';

// 임시 디렉터리에서 실제 파일 I/O 테스트

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-hooks-test-'));
}

async function runHooks(args: string[], cwd: string) {
  const origCwd = process.cwd;
  process.cwd = () => cwd;

  const program = new Command();
  program.exitOverride();
  registerHooksCommand(program);

  try {
    await program.parseAsync(['node', 'test', 'hooks', ...args]);
  } finally {
    process.cwd = origCwd;
  }
}

describe('hooks command', () => {
  let tmpDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('hooks install', () => {
    it('creates .claude/settings.local.json when it does not exist', async () => {
      await runHooks(['install'], tmpDir);

      const settingsPath = path.join(tmpDir, '.claude', 'settings.local.json');
      const exists = await fs.access(settingsPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('settings.local.json contains PreCompact hook after install', async () => {
      await runHooks(['install'], tmpDir);

      const settingsPath = path.join(tmpDir, '.claude', 'settings.local.json');
      const raw = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(raw);

      expect(settings.hooks).toBeDefined();
      expect(Array.isArray(settings.hooks.PreCompact)).toBe(true);
      expect(settings.hooks.PreCompact.length).toBeGreaterThan(0);
    });

    it('hook command contains "apply default"', async () => {
      await runHooks(['install', 'default'], tmpDir);

      const settingsPath = path.join(tmpDir, '.claude', 'settings.local.json');
      const raw = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(raw);

      const hookEntry = settings.hooks.PreCompact[0];
      const hookCommand = hookEntry.hooks[0].command as string;
      expect(hookCommand).toContain('apply default');
    });

    it('hook command contains --quiet flag', async () => {
      await runHooks(['install'], tmpDir);

      const settingsPath = path.join(tmpDir, '.claude', 'settings.local.json');
      const raw = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(raw);

      const hookEntry = settings.hooks.PreCompact[0];
      const hookCommand = hookEntry.hooks[0].command as string;
      expect(hookCommand).toContain('--quiet');
    });

    it('preserves existing settings when installing', async () => {
      // 기존 설정 생성
      const claudeDir = path.join(tmpDir, '.claude');
      await fs.mkdir(claudeDir, { recursive: true });
      const settingsPath = path.join(claudeDir, 'settings.local.json');
      await fs.writeFile(settingsPath, JSON.stringify({ existingKey: 'existingValue' }), 'utf-8');

      await runHooks(['install'], tmpDir);

      const raw = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(raw);

      // 기존 키 보존
      expect(settings.existingKey).toBe('existingValue');
      // aiwright hook 추가
      expect(settings.hooks?.PreCompact).toBeDefined();
    });

    it('does not add duplicate hook when called twice', async () => {
      await runHooks(['install'], tmpDir);
      await runHooks(['install'], tmpDir);

      const settingsPath = path.join(tmpDir, '.claude', 'settings.local.json');
      const raw = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(raw);

      // aiwright hook은 1개만 있어야 함
      const aiwrightHooks = (settings.hooks.PreCompact as Array<{ hooks: Array<{ __aiwright_hook__?: boolean }> }>)
        .filter((entry) => entry.hooks.some((h) => h.__aiwright_hook__ === true));
      expect(aiwrightHooks.length).toBe(1);
    });

    it('outputs success message after install', async () => {
      await runHooks(['install'], tmpDir);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
      expect(allOutput).toContain('Hook installed');
    });
  });

  describe('hooks remove', () => {
    it('shows "Nothing to remove" when no settings file exists', async () => {
      await runHooks(['remove'], tmpDir);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
      expect(allOutput).toContain('Nothing to remove');
    });

    it('removes aiwright hook and leaves other hooks intact', async () => {
      // 먼저 install
      await runHooks(['install'], tmpDir);

      // 다른 hook 추가
      const settingsPath = path.join(tmpDir, '.claude', 'settings.local.json');
      const raw = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(raw);
      settings.hooks.PreCompact.push({
        matcher: '',
        hooks: [{ type: 'command', command: 'other-tool run' }],
      });
      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

      // remove 실행
      await runHooks(['remove'], tmpDir);

      const rawAfter = await fs.readFile(settingsPath, 'utf-8');
      const settingsAfter = JSON.parse(rawAfter);

      // aiwright hook이 제거되었는지 확인
      const aiwrightHooks = (settingsAfter.hooks.PreCompact as Array<{ hooks: Array<{ __aiwright_hook__?: boolean }> }>)
        .filter((entry) => entry.hooks.some((h) => h.__aiwright_hook__ === true));
      expect(aiwrightHooks.length).toBe(0);

      // 다른 hook은 남아있어야 함
      const otherHooks = (settingsAfter.hooks.PreCompact as Array<{ hooks: Array<{ command: string }> }>)
        .filter((entry) => entry.hooks.some((h) => h.command === 'other-tool run'));
      expect(otherHooks.length).toBe(1);
    });

    it('shows removed count after remove', async () => {
      await runHooks(['install'], tmpDir);

      // reset spy
      consoleLogSpy.mockClear();

      await runHooks(['remove'], tmpDir);

      const allOutput = consoleLogSpy.mock.calls.map((c) => c[0] as string).join('\n');
      expect(allOutput).toContain('Removed');
    });
  });
});
