import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { fileExists } from '../utils/fs.js';
import { ProjectConfigSchema } from '../schema/config.js';
import { resolveFragment } from '../core/resolver.js';
import { loadFragment } from '../core/loader.js';
import { validateRecipe, assertValid } from '../core/validator.js';
import { compose } from '../core/composer.js';
import { render } from '../core/renderer.js';
import { appendManifest } from '../core/manifest.js';
import { detectAdapter, getAdapter } from '../adapter/detect.js';
import {
  ConfigNotFoundError,
  RecipeNotFoundError,
  AiwrightError,
  ValidationError,
} from '../utils/errors.js';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { extractPromptMetrics } from '../intelligence/extract-metrics.js';
import { lintComposed } from '../intelligence/linter.js';
import { recordUsageEvent, loadProfile } from '../intelligence/storage.js';
import { adaptFragments } from '../intelligence/adapt.js';
import { addGitNote } from '../intelligence/git-trace.js';

export function registerApplyCommand(program: Command): void {
  program
    .command('apply <recipe>')
    .description('Apply a recipe to the project')
    .option('--dry-run', 'Print composed prompt without applying')
    .option('--diff', 'Show diff between current and new prompt')
    .option('--adapter <name>', 'Override adapter (claude-code, cursor, generic)')
    .action(async (recipeName: string, opts: { dryRun?: boolean; diff?: boolean; adapter?: string }) => {
      const projectDir = process.cwd();
      const configPath = path.join(projectDir, 'aiwright.config.yaml');

      try {
        // 1. Read aiwright.config.yaml
        if (!(await fileExists(configPath))) {
          throw new ConfigNotFoundError(projectDir);
        }

        const rawConfig = await fs.readFile(configPath, 'utf-8');
        const parsedConfig = yaml.load(rawConfig);
        const configResult = ProjectConfigSchema.safeParse(parsedConfig);

        if (!configResult.success) {
          const details = configResult.error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join('; ');
          throw new ValidationError(`Invalid aiwright.config.yaml: ${details}`);
        }

        const config = configResult.data;

        // 2. Find recipe
        const recipeEntry = config.recipes[recipeName];
        if (!recipeEntry) {
          throw new RecipeNotFoundError(recipeName);
        }

        const recipe = {
          name: recipeName,
          ...recipeEntry,
        };

        // 3. Adaptive fragment adjustment
        const profile = await loadProfile().catch(() => null);
        let effectiveEntries: Array<{fragment: string; enabled?: boolean; vars?: Record<string, unknown>}> = recipe.fragments;
        if (profile?.adaptive?.enabled) {
          const adapted = adaptFragments(recipe.fragments, profile);
          effectiveEntries = adapted.entries;
          if (adapted.actions.length > 0) {
            console.log(chalk.dim('  [adaptive]'));
            for (const a of adapted.actions) {
              console.log(chalk.dim(`    ${a.type === 'inject' ? '+' : '-'} ${a.fragment}: ${a.reason}`));
            }
          }
        }

        // 4. Resolve + load each fragment (effectiveEntries 기반)
        const resolveOpts = { projectDir };
        const fragmentFiles = await Promise.all(
          effectiveEntries.map(async (entry) => {
            const resolved = await resolveFragment(entry.fragment, resolveOpts);
            return loadFragment(resolved.path);
          })
        );

        // 5. Validate
        const validationResult = validateRecipe(recipe, fragmentFiles);

        if (validationResult.warnings.length > 0) {
          for (const w of validationResult.warnings) {
            console.warn(chalk.yellow(`  Warning: ${w.message}`));
          }
        }

        assertValid(validationResult);

        // 6. Compose
        const enabledNames = new Set(
          effectiveEntries
            .filter((e) => e.enabled !== false)
            .map((e) => e.fragment)
        );
        const composed = compose(fragmentFiles, enabledNames);

        // 7. Render (apply vars)
        const rendered = render(composed, recipe.vars ?? {}, config.vars ?? {});

        // 6a. Extract prompt metrics + lint (정적 분석)
        const promptMetrics = extractPromptMetrics(rendered.fullText, rendered.sections);
        const lintResults = lintComposed(rendered.fullText, rendered.sections, promptMetrics);
        const highWarnLints = lintResults.filter((r) => r.severity === 'HIGH' || r.severity === 'WARN');
        if (highWarnLints.length > 0) {
          for (const lint of highWarnLints) {
            const color = lint.severity === 'HIGH' ? chalk.red : chalk.yellow;
            console.warn(color(`  [${lint.id}] ${lint.name}: ${lint.message}`));
          }
        }

        // --dry-run: print and exit
        if (opts.dryRun) {
          console.log(chalk.bold.cyan('--- Dry Run: Composed Prompt ---'));
          console.log(rendered.fullText);
          console.log(chalk.bold.cyan('--- End ---'));
          return;
        }

        // 7. Get adapter
        let adapter;
        if (opts.adapter) {
          adapter = getAdapter(opts.adapter);
        } else if (recipe.adapter && recipe.adapter !== 'generic') {
          adapter = getAdapter(recipe.adapter);
        } else {
          adapter = await detectAdapter(projectDir);
        }

        // --diff: compare before applying
        if (opts.diff) {
          const existing = await adapter.read(projectDir);
          const existingText = existing?.fullText ?? '(none)';
          const newText = rendered.fullText;

          console.log(chalk.bold.cyan('--- Current ---'));
          console.log(existingText);
          console.log(chalk.bold.cyan('--- New ---'));
          console.log(newText);
          console.log(chalk.bold.cyan('--- End Diff ---'));
        }

        // Apply
        const result = await adapter.apply(rendered, projectDir);

        if (!result.success) {
          console.error(chalk.red(`Error [E009]: ${result.message}`));
          process.exit(1);
        }

        console.log(chalk.green('✔') + ` Applied recipe ${chalk.bold(recipeName)}`);
        for (const p of result.outputPaths) {
          console.log(chalk.dim(`  → ${p}`));
        }
        if (result.message) {
          console.log(chalk.dim(`  ${result.message}`));
        }
        if (result.postActions && result.postActions.length > 0) {
          for (const action of result.postActions) {
            console.log(chalk.yellow(`  Action: ${action}`));
          }
        }

        // 7a. Record usage event (비침습적, 실패해도 무시)
        try {
          await recordUsageEvent({
            event_id: randomUUID(),
            event_type: 'apply',
            timestamp: new Date().toISOString(),
            recipe: recipeName,
            fragments: rendered.fragments,
            adapter: adapter.name,
            domain_tags: [],
            prompt_metrics: promptMetrics,
          });
        } catch {
          // 이벤트 기록 실패는 apply 결과에 영향을 주지 않음
        }

        // 7b. Git note 태깅 (비침습적, 실패해도 무시)
        try {
          const currentProfile = await loadProfile().catch(() => null);
          await addGitNote({
            recipe: recipeName,
            fragments: rendered.fragments,
            dna_code: currentProfile?.dna_code,
          });
        } catch {
          // git note 기록 실패는 apply 결과에 영향을 주지 않음
        }

        // 8. Update manifest
        const outputHash = createHash('sha256')
          .update(rendered.fullText)
          .digest('hex')
          .slice(0, 16);

        await appendManifest(projectDir, {
          recipe: recipeName,
          adapter: adapter.name,
          applied_at: new Date().toISOString(),
          fragments_applied: rendered.fragments,
          output_hash: outputHash,
          output_path: result.outputPaths[0] ?? '',
        });

      } catch (err) {
        if (err instanceof AiwrightError) {
          console.error(chalk.red(err.format()));
          if (err.suggestion) {
            console.error(chalk.dim(`  Suggestion: ${err.suggestion}`));
          }
          const isValidation = err.code === 'E004';
          process.exit(isValidation ? 2 : 1);
        }
        if (err instanceof Error) {
          console.error(chalk.red(`Error: ${err.message}`));
        } else {
          console.error(chalk.red('Unexpected error during apply'));
        }
        process.exit(1);
      }
    });
}
