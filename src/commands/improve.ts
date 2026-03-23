import path from 'node:path';
import fs from 'node:fs/promises';
import { Command } from 'commander';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { loadProfile } from '../intelligence/storage.js';
import { optimizeCombination } from '../intelligence/optimizer.js';
import { evolveFragments } from '../intelligence/evolution.js';
import { generateKata } from '../intelligence/kata.js';
import { diagnoseWeaknesses } from '../intelligence/diagnose.js';
import { resolveAllFragments, resolveFragment } from '../core/resolver.js';
import { loadFragment } from '../core/loader.js';
import { ProjectConfigSchema } from '../schema/config.js';
import { fileExists } from '../utils/fs.js';
import { ConfigNotFoundError, RecipeNotFoundError } from '../utils/errors.js';

export function registerImproveCommand(program: Command): void {
  program
    .command('improve [recipe]')
    .description('Improvement guide: optimize + evolve + kata in one view')
    .action(async (recipeName: string = 'default') => {
      const projectDir = process.cwd();
      const configPath = path.join(projectDir, 'aiwright.config.yaml');

      try {
        if (!(await fileExists(configPath))) {
          throw new ConfigNotFoundError(projectDir);
        }

        const rawConfig = await fs.readFile(configPath, 'utf-8');
        const parsedConfig = yaml.load(rawConfig);
        const configResult = ProjectConfigSchema.safeParse(parsedConfig);

        if (!configResult.success || !configResult.data.recipes[recipeName]) {
          throw new RecipeNotFoundError(recipeName);
        }

        const config = configResult.data;
        const recipeEntry = config.recipes[recipeName];
        const recipeFragments = recipeEntry.fragments
          .filter((e) => e.enabled !== false)
          .map((e) => e.fragment);

        // Profile 로드
        const profile = await loadProfile().catch(() => null);

        // 모든 Fragment 로드 (optimize용)
        const resolveOpts = { projectDir };
        const allResolved = await resolveAllFragments(resolveOpts);
        const allFragments = await Promise.all(
          allResolved.map((r) => loadFragment(r.path).catch(() => null)),
        ).then((results) => results.filter((f): f is NonNullable<typeof f> => f !== null));

        // recipe의 실제 Fragment 로드 (evolve용)
        const recipeFragmentFiles = await Promise.all(
          recipeFragments.map(async (name) => {
            try {
              const resolved = await resolveFragment(name, resolveOpts);
              return loadFragment(resolved.path);
            } catch {
              return null;
            }
          }),
        ).then((results) => results.filter((f): f is NonNullable<typeof f> => f !== null));

        console.log(chalk.bold(`Improvement Guide: ${recipeName}`));
        console.log(chalk.dim('═'.repeat(43)));

        // 1. Optimize: top suggestion
        if (allFragments.length > 0) {
          const optimizeResult = optimizeCombination(allFragments, {
            available_fragments: allFragments.map((f) => f.meta.name),
            current_recipe_fragments: recipeFragments,
            max_iterations: 20,
            target_metric: 'overall',
          });

          const added = optimizeResult.best_combination.filter(
            (name) => !recipeFragments.includes(name),
          );
          const removed = recipeFragments.filter(
            (name) => !optimizeResult.best_combination.includes(name),
          );

          const pctChange = optimizeResult.improvement * 100;
          const changeStr =
            pctChange > 0
              ? chalk.green(`+${pctChange.toFixed(0)}% est.`)
              : chalk.dim('no change');

          let optimizeDesc = '';
          if (added.length > 0) {
            optimizeDesc = `+${added[0]}`;
          } else if (removed.length > 0) {
            optimizeDesc = `-${removed[0]}`;
          } else {
            optimizeDesc = 'no changes needed';
          }

          console.log(
            `${chalk.bold('1. Optimize:')} ${chalk.cyan(optimizeDesc)} (score ${changeStr})`,
          );
        } else {
          console.log(chalk.dim('1. Optimize: No fragments available'));
        }

        // 2. Evolve: top suggestion
        if (recipeFragmentFiles.length > 0 && profile) {
          const weaknesses = diagnoseWeaknesses(profile.style);
          const evolveResult = evolveFragments(recipeFragmentFiles, profile.style, weaknesses);

          if (evolveResult.evolved_fragments.length > 0) {
            const top = evolveResult.evolved_fragments[0];
            const currentStrategy = evolveResult.strategy_evolution.current;
            const suggestedStrategy = evolveResult.strategy_evolution.suggested;

            // suggestion에서 첫 번째 의미있는 라인 추출
            const suggestionLine = top.suggestion
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.length > 0)
              .find((l) => !recipeFragmentFiles.some((f) => f.body.includes(l)));

            console.log(
              `${chalk.bold('2. Evolve:')} ${currentStrategy} → add "${suggestionLine ?? top.improvement_type}"`,
            );
          } else {
            console.log(chalk.dim('2. Evolve: All fragments look good'));
          }
        } else if (!profile) {
          console.log(chalk.dim('2. Evolve: Run `aiwright apply` first to collect profile data'));
        } else {
          console.log(chalk.dim('2. Evolve: No fragments found for this recipe'));
        }

        // 3. Kata: today's challenge
        const weaknesses = profile ? diagnoseWeaknesses(profile.style) : [];
        const style = profile?.style ?? {
          verbosity: 0,
          specificity: 0,
          context_ratio: 0,
          constraint_usage: 0,
          example_usage: 0,
          imperative_clarity: 0,
        };

        const kata = generateKata(weaknesses, style);
        console.log(
          `${chalk.bold('3. Kata:')} "${chalk.cyan(kata.title)}" [${kata.difficulty}]`,
        );
        console.log(chalk.dim(`   ${kata.task}`));
        console.log(chalk.dim('═'.repeat(43)));
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(`Error: ${err.message}`));
        } else {
          console.error(chalk.red('Unexpected error during improve'));
        }
        process.exit(1);
      }
    });
}
