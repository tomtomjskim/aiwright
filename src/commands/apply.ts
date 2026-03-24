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
  ApplyFailedError,
} from '../utils/errors.js';
import { computeDiff, formatDiff } from '../utils/diff.js';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { extractPromptMetrics } from '../intelligence/extract-metrics.js';
import { lintComposed } from '../intelligence/linter.js';
import { recordUsageEvent, loadEvents, loadProfile, saveProfile } from '../intelligence/storage.js';
import type { UsageEvent } from '../schema/usage-event.js';
import { adaptFragments } from '../intelligence/adapt.js';
import { addGitNote } from '../intelligence/git-trace.js';
import { computeAutoScore } from '../intelligence/auto-score.js';
import { printCompactSummary } from '../intelligence/compact-summary.js';
import { computeStyle, generateDnaCode, aggregateDomains } from '../intelligence/profiler.js';
import { diagnoseWeaknesses } from '../intelligence/diagnose.js';
import { computeBehavior } from '../intelligence/behavior.js';
import { computeGrowth } from '../intelligence/growth.js';

export function registerApplyCommand(program: Command): void {
  program
    .command('apply <recipe>')
    .description('Apply a recipe to the project')
    .option('--dry-run', 'Print composed prompt without applying')
    .option('--diff', 'Show diff between current and new prompt')
    .option('--adapter <name>', 'Override adapter (claude-code, cursor, generic)')
    .option('--quiet', 'Compact single-line output (for hooks)')
    .action(
      async (
        recipeName: string,
        opts: { dryRun?: boolean; diff?: boolean; adapter?: string; quiet?: boolean },
      ) => {
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
          let effectiveEntries: Array<{
            fragment: string;
            enabled?: boolean;
            vars?: Record<string, unknown>;
          }> = recipe.fragments;
          if (profile?.adaptive?.enabled) {
            const adapted = adaptFragments(recipe.fragments, profile);
            effectiveEntries = adapted.entries;
            if (adapted.actions.length > 0 && !opts.quiet) {
              console.log(chalk.dim('  [adaptive]'));
              for (const a of adapted.actions) {
                console.log(
                  chalk.dim(`    ${a.type === 'inject' ? '+' : '-'} ${a.fragment}: ${a.reason}`),
                );
              }
            }
          }

          // 4. Resolve + load each fragment (effectiveEntries 기반)
          const resolveOpts = { projectDir };
          const fragmentFiles = await Promise.all(
            effectiveEntries.map(async (entry) => {
              const resolved = await resolveFragment(entry.fragment, resolveOpts);
              return loadFragment(resolved.path);
            }),
          );

          // 5. Validate
          const validationResult = validateRecipe(recipe, fragmentFiles);

          if (validationResult.warnings.length > 0 && !opts.quiet) {
            for (const w of validationResult.warnings) {
              console.warn(chalk.yellow(`  Warning: ${w.message}`));
            }
          }

          assertValid(validationResult);

          // 6. Compose
          const enabledNames = new Set(
            effectiveEntries.filter((e) => e.enabled !== false).map((e) => e.fragment),
          );
          const composed = compose(fragmentFiles, enabledNames);

          // 7. Render (apply vars)
          const rendered = render(composed, recipe.vars ?? {}, config.vars ?? {});

          // 6a. Extract prompt metrics + lint (정적 분석)
          const promptMetrics = extractPromptMetrics(rendered.fullText, rendered.sections);
          const lintResults = lintComposed(rendered.fullText, rendered.sections, promptMetrics);
          const highWarnLints = lintResults.filter(
            (r) => r.severity === 'HIGH' || r.severity === 'WARN',
          );
          if (highWarnLints.length > 0 && !opts.quiet) {
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

          // --diff: compare before applying (unified diff 스타일)
          if (opts.diff) {
            const existing = await adapter.read(projectDir);
            const existingText = existing?.fullText ?? '';
            const newText = rendered.fullText;

            const diffLines = computeDiff(existingText, newText);
            const formatted = formatDiff(diffLines);

            console.log(chalk.bold.cyan('--- Diff ---'));
            console.log(formatted);
            console.log(chalk.bold.cyan('--- End Diff ---'));
          }

          // Apply
          const result = await adapter.apply(rendered, projectDir);

          if (!result.success) {
            throw new ApplyFailedError(result.message ?? 'Adapter apply failed');
          }

          // 7a. Record usage event (비침습적, 실패해도 무시)
          const currentEvent = {
            event_id: randomUUID(),
            event_type: 'apply' as const,
            timestamp: new Date().toISOString(),
            recipe: recipeName,
            fragments: rendered.fragments,
            adapter: adapter.name,
            domain_tags: [],
            prompt_metrics: promptMetrics,
          };

          try {
            await recordUsageEvent(currentEvent);
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

          // Phase 5: Auto Score
          const scoreBundle = await computeAutoScore(
            fragmentFiles,
            rendered.fullText,
            rendered.sections,
            lintResults,
            config.judge,
          );

          // Phase 5b: Auto Profile Update (비침습적)
          let updatedProfile = await loadProfile().catch(() => null);
          try {
            const events = await loadEvents().catch((): UsageEvent[] => []);
            events.push(currentEvent);
            const style = computeStyle(events);
            const dnaCode = generateDnaCode(style);
            const weaknesses = diagnoseWeaknesses(style);
            const behavior = computeBehavior(events);
            const growth = computeGrowth(events);
            const domains = aggregateDomains(events);
            const existingProfile = await loadProfile().catch(() => null);
            await saveProfile({
              version: '1',
              user_id: 'default',
              updated_at: new Date().toISOString(),
              style,
              dna_code: dnaCode,
              weaknesses,
              domains,
              adaptive: existingProfile?.adaptive ?? { enabled: false, rules: [] },
              behavior,
              growth,
              total_events: events.length,
            });
            updatedProfile = await loadProfile().catch(() => null);
          } catch {
            // 프로파일 갱신 실패 무시
          }

          // Phase 6: Compact Summary 출력
          printCompactSummary({
            recipeName,
            fragmentCount: rendered.fragments.length,
            outputPaths: result.outputPaths,
            dnaCode: updatedProfile?.dna_code ?? '---',
            score: scoreBundle,
            lintResults,
            weaknesses: updatedProfile?.weaknesses ?? [],
            quiet: opts.quiet,
          });

          // postActions 출력 (quiet 아닐 때만)
          if (!opts.quiet && result.postActions && result.postActions.length > 0) {
            for (const action of result.postActions) {
              console.log(chalk.yellow(`  Action: ${action}`));
            }
          }
        } catch (err) {
          throw err;
        }
      },
    );
}
