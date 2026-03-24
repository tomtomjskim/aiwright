import path from 'node:path';
import fs from 'node:fs/promises';
import { Command } from 'commander';
import chalk from 'chalk';
import { fileExists, ensureDir } from '../utils/fs.js';

const AIWRIGHT_HOOK_MARKER = '__aiwright_hook__';

interface ClaudeSettings {
  hooks?: {
    PreCompact?: Array<{
      matcher: string;
      hooks: Array<{
        type: string;
        command: string;
        [key: string]: unknown;
      }>;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * aiwright CLI 경로 해결
 * which aiwright → 없으면 dist/cli.js 절대경로
 */
async function resolveAiwrightPath(): Promise<string> {
  // which aiwright 시도
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync('which', ['aiwright']);
    const resolved = stdout.trim();
    if (resolved) return resolved;
  } catch {
    // which 실패 시 fallback
  }

  // fallback: dist/cli.js 절대경로
  const distCli = new URL('../../dist/cli.js', import.meta.url).pathname;
  return `node ${distCli}`;
}

function settingsPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'settings.local.json');
}

async function readSettings(filePath: string): Promise<ClaudeSettings> {
  if (!(await fileExists(filePath))) return {};
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as ClaudeSettings;
  } catch {
    return {};
  }
}

async function writeSettings(filePath: string, settings: ClaudeSettings): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

/**
 * 프로그래밍 방식으로 hook 설치 (init에서 호출)
 */
export async function installHookDirect(projectDir: string, recipe = 'default'): Promise<boolean> {
  try {
    const filePath = settingsPath(projectDir);
    const aiwrightPath = await resolveAiwrightPath();
    const hookCommand = `${aiwrightPath} apply ${recipe} --quiet`;

    const settings = await readSettings(filePath);
    if (!settings.hooks) settings.hooks = {};
    if (!Array.isArray(settings.hooks.PreCompact)) settings.hooks.PreCompact = [];

    const existing = settings.hooks.PreCompact.find(
      (entry) =>
        Array.isArray(entry.hooks) &&
        entry.hooks.some((h: Record<string, unknown>) => h[AIWRIGHT_HOOK_MARKER] === true),
    );
    if (existing) return false; // 이미 설치됨

    settings.hooks.PreCompact.push({
      matcher: '',
      hooks: [{ type: 'command', command: hookCommand, [AIWRIGHT_HOOK_MARKER]: true }],
    });

    await writeSettings(filePath, settings);
    return true;
  } catch {
    return false;
  }
}

export function registerHooksCommand(program: Command): void {
  const hooksCmd = program
    .command('hooks')
    .description('Manage Claude Code hooks for aiwright');

  hooksCmd
    .command('install [recipe]')
    .description('Install PreCompact hook in .claude/settings.local.json')
    .action(async (recipe: string = 'default') => {
      const projectDir = process.cwd();
      const filePath = settingsPath(projectDir);

      try {
        const aiwrightPath = await resolveAiwrightPath();
        const hookCommand = `${aiwrightPath} apply ${recipe} --quiet`;

        const settings = await readSettings(filePath);

        // hooks 초기화
        if (!settings.hooks) settings.hooks = {};
        if (!Array.isArray(settings.hooks.PreCompact)) settings.hooks.PreCompact = [];

        // 이미 aiwright hook이 있으면 업데이트 없이 알림
        const existing = settings.hooks.PreCompact.find(
          (entry) =>
            Array.isArray(entry.hooks) &&
            entry.hooks.some((h: Record<string, unknown>) => h[AIWRIGHT_HOOK_MARKER] === true),
        );

        if (existing) {
          console.log(chalk.yellow('aiwright hook already installed.'));
          return;
        }

        // PreCompact hook 추가
        settings.hooks.PreCompact.push({
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: hookCommand,
              [AIWRIGHT_HOOK_MARKER]: true,
            },
          ],
        });

        await writeSettings(filePath, settings);
        console.log(chalk.green('✔') + ' Hook installed: Claude Code (PreCompact)');
        console.log(chalk.dim(`  → ${filePath}`));
        console.log(chalk.dim(`  Command: ${hookCommand}`));
      } catch (err) {
        throw err;
      }
    });

  hooksCmd
    .command('remove')
    .description('Remove aiwright hooks from .claude/settings.local.json')
    .action(async () => {
      const projectDir = process.cwd();
      const filePath = settingsPath(projectDir);

      try {
        if (!(await fileExists(filePath))) {
          console.log(chalk.dim('No settings.local.json found. Nothing to remove.'));
          return;
        }

        const settings = await readSettings(filePath);

        if (!settings.hooks?.PreCompact || !Array.isArray(settings.hooks.PreCompact)) {
          console.log(chalk.dim('No PreCompact hooks found. Nothing to remove.'));
          return;
        }

        const before = settings.hooks.PreCompact.length;

        // aiwright가 추가한 hook만 제거
        settings.hooks.PreCompact = settings.hooks.PreCompact.filter(
          (entry) =>
            !Array.isArray(entry.hooks) ||
            !entry.hooks.some(
              (h) => typeof h.command === 'string' && h[AIWRIGHT_HOOK_MARKER] === true,
            ),
        );

        const after = settings.hooks.PreCompact.length;
        const removed = before - after;

        await writeSettings(filePath, settings);

        if (removed > 0) {
          console.log(chalk.green('✔') + ` Removed ${String(removed)} aiwright hook(s)`);
          console.log(chalk.dim(`  → ${filePath}`));
        } else {
          console.log(chalk.dim('No aiwright hooks found to remove.'));
        }
      } catch (err) {
        throw err;
      }
    });
}
