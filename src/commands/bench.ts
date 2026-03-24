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
import { appendHistory } from '../scoring/history.js';
import {
  ConfigNotFoundError,
  RecipeNotFoundError,
  CasesFileError,
  AiwrightError,
  ValidationError,
  CommandError,
} from '../utils/errors.js';
import { ScoreResultSchema } from '../schema/score.js';

interface Assertion {
  type: 'contains' | 'not_contains' | 'format' | 'length_gt' | 'length_lt' | 'regex';
  value: string | number;
}

interface TestCase {
  name: string;
  input?: Record<string, unknown>;
  assertions: Assertion[];
}

interface CasesFile {
  cases: TestCase[];
}

function runAssertion(text: string, assertion: Assertion): { pass: boolean; reason: string } {
  switch (assertion.type) {
    case 'contains': {
      const pass = text.includes(String(assertion.value));
      return { pass, reason: pass ? 'OK' : `Expected text to contain "${assertion.value}"` };
    }
    case 'not_contains': {
      const pass = !text.includes(String(assertion.value));
      return { pass, reason: pass ? 'OK' : `Expected text NOT to contain "${assertion.value}"` };
    }
    case 'length_gt': {
      const pass = text.length > Number(assertion.value);
      return { pass, reason: pass ? 'OK' : `Expected length > ${assertion.value}, got ${text.length}` };
    }
    case 'length_lt': {
      const pass = text.length < Number(assertion.value);
      return { pass, reason: pass ? 'OK' : `Expected length < ${assertion.value}, got ${text.length}` };
    }
    case 'regex': {
      const pattern = String(assertion.value);
      if (pattern.length > 200) {
        return { pass: false, reason: `Regex pattern too long (${pattern.length} chars, max 200)` };
      }
      let re: RegExp;
      try {
        re = new RegExp(pattern);
      } catch (err) {
        return { pass: false, reason: `Invalid regex: ${err instanceof Error ? err.message : 'unknown'}` };
      }
      const pass = re.test(text);
      return { pass, reason: pass ? 'OK' : `Expected text to match regex /${pattern}/` };
    }
    case 'format': {
      // format assertion: checks if the text loosely matches a format description (markdown/json/plain)
      const fmt = String(assertion.value).toLowerCase();
      let pass = false;
      if (fmt === 'json') {
        try { JSON.parse(text); pass = true; } catch { pass = false; }
      } else if (fmt === 'markdown') {
        pass = /^#{1,6}\s|^\*\*|^\- |```/.test(text);
      } else {
        pass = text.trim().length > 0;
      }
      return { pass, reason: pass ? 'OK' : `Expected format: ${fmt}` };
    }
    default: {
      return { pass: false, reason: `Unknown assertion type: ${(assertion as Assertion).type}` };
    }
  }
}

export function registerBenchCommand(program: Command): void {
  program
    .command('bench <recipe>')
    .description('Benchmark a recipe against test cases')
    .requiredOption('--cases <path>', 'Path to cases YAML file')
    .option('--save', 'Save benchmark results to scoring history')
    .option('--format <format>', 'Output format: text or json', 'text')
    .action(async (recipeName: string, opts: { cases: string; save?: boolean; format?: string }) => {
      const projectDir = process.cwd();
      const configPath = path.join(projectDir, 'aiwright.config.yaml');

      try {
        // Load config
        if (!(await fileExists(configPath))) {
          throw new ConfigNotFoundError(projectDir);
        }

        const rawConfig = await fs.readFile(configPath, 'utf-8');
        const parsedConfig = yaml.load(rawConfig);
        const configResult = ProjectConfigSchema.safeParse(parsedConfig);
        if (!configResult.success) {
          const details = configResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
          throw new ValidationError(`Invalid aiwright.config.yaml: ${details}`);
        }
        const config = configResult.data;

        // Find recipe
        const recipeEntry = config.recipes[recipeName];
        if (!recipeEntry) {
          throw new RecipeNotFoundError(recipeName);
        }
        const recipe = { name: recipeName, ...recipeEntry };

        // Load cases file
        const casesPath = path.resolve(projectDir, opts.cases);
        if (!(await fileExists(casesPath))) {
          throw new CasesFileError(casesPath, 'File not found');
        }

        let casesRaw: unknown;
        try {
          const content = await fs.readFile(casesPath, 'utf-8');
          casesRaw = yaml.load(content);
        } catch (e) {
          throw new CasesFileError(casesPath, `YAML parse error: ${String(e)}`);
        }

        if (
          typeof casesRaw !== 'object' ||
          casesRaw === null ||
          !Array.isArray((casesRaw as CasesFile).cases)
        ) {
          throw new CasesFileError(casesPath, 'Expected a "cases" array');
        }

        const casesFile = casesRaw as CasesFile;
        const cases = casesFile.cases;

        // Resolve + load fragments
        const resolveOpts = { projectDir };
        const fragmentFiles = await Promise.all(
          recipe.fragments.map(async (entry) => {
            const resolved = await resolveFragment(entry.fragment, resolveOpts);
            return loadFragment(resolved.path);
          })
        );

        // Validate
        const validationResult = validateRecipe(recipe, fragmentFiles);
        assertValid(validationResult);

        // Compose + render base prompt
        const enabledNames = new Set(
          recipe.fragments
            .filter((e) => e.enabled !== false)
            .map((e) => e.fragment)
        );
        const composed = compose(fragmentFiles, enabledNames);
        const rendered = render(composed, recipe.vars ?? {}, config.vars ?? {});

        const isJson = opts.format === 'json';

        interface AssertionResult {
          type: string;
          pass: boolean;
          reason: string;
        }
        interface CaseResult {
          case: string;
          assertions: AssertionResult[];
        }

        let totalAssertions = 0;
        let passedAssertions = 0;
        const caseResults: CaseResult[] = [];

        if (!isJson) {
          console.log(chalk.bold(`\nBench: ${recipeName}`));
          console.log(chalk.dim(`Cases: ${casesPath}`));
          console.log(chalk.dim('─'.repeat(60)));
        }

        for (const testCase of cases) {
          // Render with case-level vars (input)
          const caseRendered = render(
            composed,
            { ...recipe.vars, ...(testCase.input ?? {}) },
            config.vars ?? {}
          );

          const caseTotal = testCase.assertions.length;
          const casePassed: number[] = [];
          const assertionResults: AssertionResult[] = [];

          for (let i = 0; i < testCase.assertions.length; i++) {
            const assertion = testCase.assertions[i];
            const { pass, reason } = runAssertion(caseRendered.fullText, assertion);
            totalAssertions++;
            assertionResults.push({ type: assertion.type, pass, reason });
            if (pass) {
              passedAssertions++;
              casePassed.push(i);
            } else if (!isJson) {
              console.log(
                `  ${chalk.red('FAIL')} [${testCase.name}] assertion #${i + 1} (${assertion.type}): ${chalk.dim(reason)}`
              );
            }
          }

          caseResults.push({ case: testCase.name, assertions: assertionResults });

          if (!isJson) {
            const allPass = casePassed.length === caseTotal;
            const icon = allPass ? chalk.green('PASS') : chalk.red('FAIL');
            console.log(`${icon} ${chalk.bold(testCase.name)} (${casePassed.length}/${caseTotal})`);
          }
        }

        const passRate = totalAssertions > 0 ? passedAssertions / totalAssertions : 1;

        if (isJson) {
          console.log(JSON.stringify({
            passRate,
            passed: passedAssertions,
            total: totalAssertions,
            results: caseResults,
          }, null, 2));
        } else {
          const pct = (passRate * 100).toFixed(1);
          const passColor = passRate === 1 ? chalk.green : passRate >= 0.8 ? chalk.yellow : chalk.red;
          console.log(chalk.dim('─'.repeat(60)));
          console.log(
            `Overall: ${passColor(`${pct}%`)} (${passedAssertions}/${totalAssertions} assertions passed)`
          );
        }

        // --save
        if (opts.save) {
          const scoreResult = ScoreResultSchema.parse({
            fragment_or_recipe: recipeName,
            timestamp: new Date().toISOString(),
            metrics: [
              {
                name: 'bench_pass_rate',
                value: passRate,
                source: 'heuristic' as const,
                rationale: `${passedAssertions}/${totalAssertions} assertions passed`,
              },
            ],
            overall: passRate,
          });

          await appendHistory(recipeName, scoreResult);
          if (!isJson) {
            console.log(chalk.dim(`\nSaved bench result to .aiwright/scores/${recipeName}.yaml`));
          }
        }

        // Exit with error if not all passed
        if (passRate < 1) {
          throw new CommandError(`Bench failed: ${passedAssertions}/${totalAssertions} assertions passed`);
        }
      } catch (err) {
        throw err;
      }
    });
}
