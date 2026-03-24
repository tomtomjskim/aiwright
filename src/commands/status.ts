import { Command } from 'commander';
import chalk from 'chalk';
import { loadProfile, loadEvents } from '../intelligence/storage.js';
import { detectDrift } from '../intelligence/drift.js';
import type { PromptStyle, Weakness } from '../schema/user-profile.js';

function progressBar(value: number, width = 10): string {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * width);
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

function severityLabel(s: 'HIGH' | 'WARN' | 'INFO'): string {
  switch (s) {
    case 'HIGH':
      return chalk.red('[HIGH]');
    case 'WARN':
      return chalk.yellow('[WARN]');
    case 'INFO':
      return chalk.dim('[INFO]');
  }
}

function printStyleProfile(style: PromptStyle): void {
  console.log(chalk.bold('\nStyle Profile'));
  const axes: Array<[string, number]> = [
    ['verbosity', style.verbosity],
    ['specificity', style.specificity],
    ['context_ratio', style.context_ratio],
    ['constraint_usage', style.constraint_usage],
    ['example_usage', style.example_usage],
    ['imperative_clarity', style.imperative_clarity],
  ];
  for (const [name, value] of axes) {
    console.log(`  ${name.padEnd(20)} ${progressBar(value)}  ${value.toFixed(2)}`);
  }
}

function printWeaknesses(weaknesses: Weakness[]): void {
  console.log(chalk.bold('\nWeaknesses') + ` (${String(weaknesses.length)})`);
  if (weaknesses.length === 0) {
    console.log(chalk.dim('  No significant weaknesses detected.'));
    return;
  }
  for (const w of weaknesses) {
    console.log(`  ${severityLabel(w.severity)} ${w.id}: ${chalk.dim(w.message)}`);
  }
}

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show profile, weaknesses, and drift summary')
    .option('--format <format>', 'Output format: text or json', 'text')
    .action(async (opts: { format?: string }) => {
      try {
        const profile = await loadProfile();
        const isJson = opts.format === 'json';

        if (!profile) {
          if (isJson) {
            console.log(JSON.stringify({ error: 'No profile found. Run `aiwright apply` first.' }, null, 2));
          } else {
            console.log(chalk.yellow('No profile found.'));
            console.log(chalk.dim('  Run `aiwright apply` first'));
          }
          return;
        }

        const events = await loadEvents().catch(() => []);

        if (isJson) {
          let drift: ReturnType<typeof detectDrift> | null = null;
          if (events.length > 0) {
            drift = detectDrift(events, 'default');
          }
          console.log(JSON.stringify({
            config: {
              dna_code: profile.dna_code ?? null,
              total_events: profile.total_events,
              updated_at: profile.updated_at,
            },
            events: events.length,
            drift: drift
              ? { level: drift.level, trend: drift.trend, message: drift.message }
              : null,
            profile: {
              style: profile.style,
              weaknesses: profile.weaknesses,
              behavior: profile.behavior ?? null,
            },
          }, null, 2));
          return;
        }

        console.log(chalk.dim('═'.repeat(43)));
        console.log(
          `DNA: ${chalk.bold.cyan(profile.dna_code ?? '---')} | Events: ${chalk.cyan(String(profile.total_events))} | Score: ${chalk.bold((profile.style.specificity * 0.4 + profile.style.constraint_usage * 0.6).toFixed(2))}`,
        );

        printStyleProfile(profile.style);
        printWeaknesses(profile.weaknesses);

        // Drift summary (default recipe)
        if (events.length > 0) {
          const driftReport = detectDrift(events, 'default');
          const driftStatus =
            driftReport.level === 'none'
              ? chalk.green('stable')
              : driftReport.level === 'warning'
                ? chalk.yellow('warning')
                : chalk.red(driftReport.level);
          console.log(chalk.bold('\nDrift:') + ` default → ${driftStatus}`);
        }

        console.log(chalk.dim('═'.repeat(43)));
      } catch (err) {
        throw err;
      }
    });
}
