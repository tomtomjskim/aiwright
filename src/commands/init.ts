import path from 'node:path';
import fs from 'node:fs/promises';
import { Command } from 'commander';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { fileExists, ensureDir, writeFileEnsure } from '../utils/fs.js';

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

async function detectAdapter(projectDir: string): Promise<string> {
  const claudeDir = path.join(projectDir, '.claude');
  const cursorrules = path.join(projectDir, '.cursorrules');

  try {
    await fs.access(claudeDir);
    return 'claude-code';
  } catch {
    // not found
  }

  try {
    await fs.access(cursorrules);
    return 'cursor';
  } catch {
    // not found
  }

  return 'generic';
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
    .action(async (opts: { adapter?: string; withBuiltins?: boolean }) => {
      const projectDir = process.cwd();
      const configPath = path.join(projectDir, 'aiwright.config.yaml');

      try {
        if (await fileExists(configPath)) {
          console.log(chalk.yellow('aiwright.config.yaml already exists. Skipping.'));
        } else {
          const detectedAdapter = opts.adapter ?? (await detectAdapter(projectDir));
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

        console.log('\n' + chalk.bold.green('aiwright initialized successfully!'));
        console.log(chalk.dim('  Run `aiwright list` to see available fragments.'));
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
