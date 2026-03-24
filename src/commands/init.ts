import path from 'node:path';
import fs from 'node:fs/promises';
import { Command } from 'commander';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { fileExists, ensureDir, writeFileEnsure } from '../utils/fs.js';
import { detectAdapter } from '../adapter/detect.js';

const DEFAULT_CONFIG = {
  version: '1',
  adapter: 'claude-code',
  vars: {},
  paths: {
    local: '.aiwright/fragments',
  },
  recipes: {
    default: {
      description: 'Default recipe',
      adapter: 'generic',
      fragments: [],
      vars: {},
    },
  },
};


async function installSkills(projectDir: string): Promise<number> {
  const skillsDir = new URL('./boilerplate/claude-skills', import.meta.url).pathname;
  const targetDir = path.join(projectDir, '.claude', 'commands');
  await ensureDir(targetDir);

  let count = 0;
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile() && e.name.endsWith('.md')).map((e) => e.name);
    for (const file of files) {
      const src = path.join(skillsDir, file);
      const dest = path.join(targetDir, file);
      const content = await fs.readFile(src, 'utf-8');
      await writeFileEnsure(dest, content);
      count++;
    }
  } catch {
    // skills 디렉터리 없으면 무시
  }
  return count;
}

async function installToolsJson(projectDir: string): Promise<void> {
  const toolsSrc = new URL('./boilerplate/tools/aiwright-tools.json', import.meta.url).pathname;
  const dest = path.join(projectDir, '.aiwright', 'tools.json');
  try {
    const content = await fs.readFile(toolsSrc, 'utf-8');
    await writeFileEnsure(dest, content);
  } catch {
    // tools.json 없으면 무시
  }
}

async function copyBuiltins(projectDir: string): Promise<string[]> {
  const builtinsDir = new URL('./builtins', import.meta.url).pathname;
  const targetDir = path.join(projectDir, '.aiwright', 'fragments');
  await ensureDir(targetDir);

  const copied: string[] = [];
  let files: string[];
  try {
    const entries = await fs.readdir(builtinsDir, { withFileTypes: true });
    files = entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name);
  } catch {
    console.warn(chalk.yellow('  Warning: Could not read builtins directory'));
    return copied;
  }

  for (const file of files) {
    const src = path.join(builtinsDir, file);
    const dest = path.join(targetDir, file);
    if (!(await fileExists(dest))) {
      const content = await fs.readFile(src, 'utf-8');
      await writeFileEnsure(dest, content);
      console.log(chalk.green(`  + ${file}`));
      copied.push(file.replace('.md', ''));
    }
  }
  return copied;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize aiwright in the current project')
    .option('--adapter <name>', 'Adapter to use (claude-code, cursor, generic)')
    .option('--with-builtins', 'Copy built-in fragments to .aiwright/fragments/')
    .option('--no-hooks', 'Skip hook installation prompt')
    .action(async (opts: { adapter?: string; withBuiltins?: boolean; hooks?: boolean }) => {
      const projectDir = process.cwd();
      const configPath = path.join(projectDir, 'aiwright.config.yaml');

      try {
        if (await fileExists(configPath)) {
          console.log(chalk.yellow('aiwright.config.yaml already exists. Skipping.'));
        } else {
          const detectedAdapter = opts.adapter ?? (await detectAdapter(projectDir)).name;
          const config = {
            ...DEFAULT_CONFIG,
            adapter: detectedAdapter,
          };

          const content = yaml.dump(config, { lineWidth: 120 });
          await writeFileEnsure(configPath, content);
          console.log(chalk.green('✔') + ' Created ' + chalk.bold('aiwright.config.yaml'));
          console.log(chalk.dim(`  Adapter: ${detectedAdapter}`));
        }

        // .aiwright/fragments/
        const fragmentsDir = path.join(projectDir, '.aiwright', 'fragments');
        await ensureDir(fragmentsDir);
        console.log(chalk.green('✔') + ' Created ' + chalk.bold('.aiwright/fragments/'));

        // .aiwright/scores/
        const scoresDir = path.join(projectDir, '.aiwright', 'scores');
        await ensureDir(scoresDir);
        console.log(chalk.green('✔') + ' Created ' + chalk.bold('.aiwright/scores/'));

        // .aiwright/manifest.yaml
        const manifestPath = path.join(projectDir, '.aiwright', 'manifest.yaml');
        if (!(await fileExists(manifestPath))) {
          const manifest = { version: '1', history: [] };
          await writeFileEnsure(manifestPath, yaml.dump(manifest, { lineWidth: 120 }));
          console.log(chalk.green('✔') + ' Created ' + chalk.bold('.aiwright/manifest.yaml'));
        }

        if (opts.withBuiltins) {
          console.log('\nCopying built-in fragments:');
          const copied = await copyBuiltins(projectDir);
          // Update default recipe with copied builtins
          if (copied.length > 0 && !(await fileExists(configPath + '.bak'))) {
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = yaml.load(configContent) as Record<string, unknown>;
            const recipes = config['recipes'] as Record<string, unknown> | undefined;
            if (recipes?.['default']) {
              const defaultRecipe = recipes['default'] as Record<string, unknown>;
              // Include non-conflicting subset: system-role + constraint-no-hallucination + output-markdown
              const defaultSet = ['system-role-engineer', 'constraint-no-hallucination', 'output-markdown'];
              defaultRecipe['fragments'] = defaultSet
                .filter((name) => copied.includes(name))
                .map((name) => ({ fragment: name }));
              await writeFileEnsure(configPath, yaml.dump(config, { lineWidth: 120 }));
            }
          }
        }

        // Claude Code skills 설치
        const skillCount = await installSkills(projectDir);
        if (skillCount > 0) {
          console.log(chalk.green('✔') + ` Installed ${chalk.bold(String(skillCount))} Claude Code skills (${chalk.dim('/aiwright-status, /aiwright-improve, ...')})`);
        }

        // LLM tools.json 설치
        await installToolsJson(projectDir);

        // Auto-apply default recipe
        try {
          const { execFile } = await import('node:child_process');
          const { promisify } = await import('node:util');
          const execFileAsync = promisify(execFile);
          const cliPath = new URL('./cli.js', import.meta.url).pathname;
          const { stdout } = await execFileAsync('node', [cliPath, 'apply', 'default', '--quiet'], { cwd: projectDir });
          if (stdout.trim()) console.log(stdout.trim());
          console.log(chalk.green('✔') + ' Auto-applied default recipe');
        } catch {
          // apply 실패해도 init 자체는 성공
          console.log(chalk.dim('  Tip: Run `aiwright apply default` to generate .claude/CLAUDE.md'));
        }

        // Auto-install hooks (--no-hooks 없을 때)
        if (opts.hooks !== false) {
          try {
            const { installHookDirect } = await import('./hooks.js');
            const installed = await installHookDirect(projectDir, 'default');
            if (installed) {
              console.log(chalk.green('✔') + ' Hook installed: Claude Code (PreCompact auto-apply)');
            }
          } catch {
            // hook 실패 무시
          }
        }

        console.log('\n' + chalk.bold.green('aiwright ready!'));
        console.log(chalk.dim('  /aiwright-help for commands. Everything runs automatically now.'));
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(`Error [E005]: ${err.message}`));
        } else {
          console.error(chalk.red('Unexpected error during init'));
        }
        process.exit(1);
      }
    });
}
