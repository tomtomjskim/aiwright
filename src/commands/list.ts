import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { fileExists } from '../utils/fs.js';
import { ProjectConfigSchema } from '../schema/config.js';
import { resolveAllFragments } from '../core/resolver.js';
import { loadFragment } from '../core/loader.js';
import fs from 'node:fs/promises';

interface FragmentInfo {
  name: string;
  slot: string;
  priority: number;
  tags: string[];
  description: string;
  layer: string;
}

function padEnd(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all available fragments and recipes')
    .option('--search <query>', 'Filter by name/tag/description')
    .option('--format <format>', 'Output format: table or json', 'table')
    .action(async (opts: { search?: string; format?: string }) => {
      const projectDir = process.cwd();

      try {
        // Collect all fragments
        const resolveOpts = { projectDir };
        const resolved = await resolveAllFragments(resolveOpts);

        const fragmentInfoList: FragmentInfo[] = [];

        for (const r of resolved) {
          try {
            const frag = await loadFragment(r.path);
            fragmentInfoList.push({
              name: frag.meta.name,
              slot: frag.meta.slot,
              priority: frag.meta.priority,
              tags: frag.meta.tags,
              description: frag.meta.description,
              layer: r.layer,
            });
          } catch {
            // skip unreadable fragments
          }
        }

        // Apply search filter
        let filtered = fragmentInfoList;
        if (opts.search) {
          const q = opts.search.toLowerCase();
          filtered = fragmentInfoList.filter(
            (f) =>
              f.name.toLowerCase().includes(q) ||
              f.description.toLowerCase().includes(q) ||
              f.tags.some((t) => t.toLowerCase().includes(q))
          );
        }

        // Sort by name
        filtered.sort((a, b) => a.name.localeCompare(b.name));

        // Load recipes from config
        let recipes: Record<string, { description: string; adapter?: string; fragments?: { fragment: string }[] }> = {};
        const configPath = path.join(projectDir, 'aiwright.config.yaml');
        if (await fileExists(configPath)) {
          try {
            const rawConfig = await fs.readFile(configPath, 'utf-8');
            const parsedConfig = yaml.load(rawConfig);
            const configResult = ProjectConfigSchema.safeParse(parsedConfig);
            if (configResult.success) {
              recipes = configResult.data.recipes as typeof recipes;
            }
          } catch {
            // skip
          }
        }

        if (opts.format === 'json') {
          const output = {
            fragments: filtered,
            recipes: Object.entries(recipes).map(([name, r]) => ({
              name,
              description: r.description,
              adapter: r.adapter ?? 'generic',
              fragmentCount: r.fragments?.length ?? 0,
            })),
          };
          console.log(JSON.stringify(output, null, 2));
          return;
        }

        // Table output
        if (filtered.length === 0 && opts.search) {
          console.log(chalk.yellow(`No fragments matching "${opts.search}"`));
        } else if (filtered.length === 0) {
          console.log(chalk.dim('No fragments found.'));
          console.log(chalk.dim('  Run `aiwright add <name>` or `aiwright create` to add fragments.'));
        } else {
          console.log(chalk.bold('\nFragments'));
          console.log(chalk.dim('─'.repeat(80)));

          const header =
            chalk.bold(padEnd('NAME', 30)) +
            chalk.bold(padEnd('SLOT', 14)) +
            chalk.bold(padEnd('PRI', 5)) +
            chalk.bold(padEnd('LAYER', 9)) +
            chalk.bold('DESCRIPTION');
          console.log(header);
          console.log(chalk.dim('─'.repeat(80)));

          for (const f of filtered) {
            const layerColor =
              f.layer === 'local' ? chalk.green : f.layer === 'global' ? chalk.blue : chalk.dim;
            const row =
              chalk.white(padEnd(f.name, 30)) +
              chalk.cyan(padEnd(f.slot, 14)) +
              chalk.dim(padEnd(String(f.priority), 5)) +
              layerColor(padEnd(f.layer, 9)) +
              chalk.dim(f.description.slice(0, 40));
            console.log(row);
          }

          console.log(chalk.dim('─'.repeat(80)));
          console.log(chalk.dim(`${filtered.length} fragment(s)`));
        }

        // Recipes section
        const recipeNames = Object.keys(recipes);
        if (recipeNames.length > 0) {
          console.log(chalk.bold('\nRecipes'));
          console.log(chalk.dim('─'.repeat(80)));

          const recipeHeader =
            chalk.bold(padEnd('NAME', 30)) +
            chalk.bold(padEnd('ADAPTER', 14)) +
            chalk.bold(padEnd('FRAGS', 6)) +
            chalk.bold('DESCRIPTION');
          console.log(recipeHeader);
          console.log(chalk.dim('─'.repeat(80)));

          for (const [name, r] of Object.entries(recipes)) {
            const row =
              chalk.white(padEnd(name, 30)) +
              chalk.cyan(padEnd(r.adapter ?? 'generic', 14)) +
              chalk.dim(padEnd(String(r.fragments?.length ?? 0), 6)) +
              chalk.dim((r.description ?? '').slice(0, 40));
            console.log(row);
          }

          console.log(chalk.dim('─'.repeat(80)));
          console.log(chalk.dim(`${recipeNames.length} recipe(s)`));
        }

        console.log('');
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(`Error: ${err.message}`));
        } else {
          console.error(chalk.red('Unexpected error during list'));
        }
        process.exit(1);
      }
    });
}
