import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import yaml from 'js-yaml';
import fs from 'node:fs/promises';
import { fileExists } from '../utils/fs.js';
import { ProjectConfigSchema } from '../schema/config.js';
import { resolveFragment } from '../core/resolver.js';
import { loadFragment } from '../core/loader.js';
import { validateRecipe, assertValid } from '../core/validator.js';
import { compose } from '../core/composer.js';
import { render } from '../core/renderer.js';
import { extractPromptMetrics } from '../intelligence/extract-metrics.js';
import { lintComposed, type LintResult } from '../intelligence/linter.js';

type Severity = 'HIGH' | 'WARN' | 'INFO';

function severityLabel(s: Severity): string {
  switch (s) {
    case 'HIGH': return chalk.red.bold('  HIGH');
    case 'WARN': return chalk.yellow('  WARN');
    case 'INFO': return chalk.dim('  INFO');
  }
}

export function registerLintCommand(program: Command): void {
  program
    .command('lint [recipe]')
    .description('Run prompt smell linter on a recipe')
    .option('--severity <level>', 'Filter by minimum severity (HIGH, WARN, INFO)', 'INFO')
    .action(async (recipeName: string | undefined, opts: { severity: string }) => {
      const projectDir = process.cwd();
      const configPath = path.join(projectDir, 'aiwright.config.yaml');

      const validSeverities: Severity[] = ['HIGH', 'WARN', 'INFO'];
      const severityFilter = opts.severity.toUpperCase() as Severity;
      if (!validSeverities.includes(severityFilter)) {
        console.error(chalk.red('Error: --severity must be HIGH, WARN, or INFO'));
        process.exit(2);
      }

      const severityOrder: Record<Severity, number> = { HIGH: 0, WARN: 1, INFO: 2 };

      try {
        if (!(await fileExists(configPath))) {
          console.error(chalk.red('Error: aiwright.config.yaml not found. Run `aiwright init` first.'));
          process.exit(1);
        }

        const rawConfig = await fs.readFile(configPath, 'utf-8');
        const config = ProjectConfigSchema.parse(yaml.load(rawConfig));

        let targetName = recipeName;
        if (!targetName) {
          const keys = Object.keys(config.recipes);
          if (keys.length === 0) {
            console.error(chalk.red('No recipes defined.'));
            process.exit(1);
          }
          targetName = keys[0];
        }

        const recipeEntry = config.recipes[targetName];
        if (!recipeEntry) {
          console.error(chalk.red(`Recipe "${targetName}" not found.`));
          process.exit(1);
        }

        const recipe = { name: targetName, ...recipeEntry };

        // resolve + load fragments
        const fragmentFiles = await Promise.all(
          recipe.fragments.map(async (entry) => {
            const resolved = await resolveFragment(entry.fragment, { projectDir });
            return loadFragment(resolved.path);
          })
        );

        // validate
        const validation = validateRecipe(recipe, fragmentFiles);
        assertValid(validation);

        // compose + render
        const enabledNames = new Set(
          recipe.fragments.filter((e) => e.enabled !== false).map((e) => e.fragment)
        );
        const composed = compose(fragmentFiles, enabledNames);
        const rendered = render(composed, recipe.vars ?? {}, config.vars ?? {});

        // extract metrics + lint
        const metrics = extractPromptMetrics(rendered.fullText, rendered.sections);
        const allResults = lintComposed(rendered.fullText, rendered.sections, metrics);

        // filter by severity
        const results = allResults.filter(
          (r) => severityOrder[r.severity] <= severityOrder[severityFilter]
        );

        // output
        console.log(chalk.bold(`Prompt Smell Check: ${targetName}`));
        console.log(chalk.dim('═'.repeat(39)));
        console.log('');

        if (results.length === 0) {
          console.log(chalk.green('  No issues found.'));
        } else {
          for (const r of results) {
            console.log(`${severityLabel(r.severity)}  ${chalk.bold(r.id)}  ${r.name}`);
            console.log(`        ${r.message}`);
            console.log('');
          }
        }

        console.log(chalk.dim('═'.repeat(39)));
        const high = results.filter((r) => r.severity === 'HIGH').length;
        const warn = results.filter((r) => r.severity === 'WARN').length;
        const info = results.filter((r) => r.severity === 'INFO').length;
        const parts: string[] = [];
        if (high > 0) parts.push(chalk.red.bold(`${high} HIGH`));
        if (warn > 0) parts.push(chalk.yellow(`${warn} WARN`));
        if (info > 0) parts.push(chalk.dim(`${info} INFO`));
        console.log(parts.length > 0 ? `  ${parts.join(' · ')}` : chalk.green('  Clean!'));

        if (high > 0) process.exit(2);
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}
