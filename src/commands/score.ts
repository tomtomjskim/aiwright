import { Command } from 'commander';
import chalk from 'chalk';
import { randomUUID } from 'node:crypto';
import { recordScore } from '../scoring/user-signal.js';
import { readHistory, getOverallTrend } from '../scoring/history.js';
import { AiwrightError, ValidationError, CommandError } from '../utils/errors.js';
import { recordUsageEvent } from '../intelligence/storage.js';

function renderAsciiChart(values: number[]): string {
  if (values.length === 0) return '  (no data)';

  const height = 5;
  const width = values.length;
  const min = 0;
  const max = 1;

  const rows: string[] = [];
  for (let row = height - 1; row >= 0; row--) {
    const threshold = min + ((row + 0.5) / height) * (max - min);
    let line = '';
    for (let col = 0; col < width; col++) {
      const val = values[col];
      line += val >= threshold ? chalk.green('█') : chalk.dim('·');
    }
    const label = (min + ((row + 1) / height) * (max - min)).toFixed(1);
    rows.push(`  ${chalk.dim(label)} │ ${line}`);
  }

  // x-axis
  const xAxis = '       └' + '─'.repeat(width);
  rows.push(xAxis);

  // x labels
  if (width > 1) {
    const first = '1';
    const last = String(width);
    const padding = width - first.length - last.length;
    const xLabels = `         ${first}${' '.repeat(Math.max(0, padding))}${last}`;
    rows.push(chalk.dim(xLabels));
  }

  return rows.join('\n');
}

export function registerScoreCommand(program: Command): void {
  program
    .command('score <name>')
    .description('View or record scores for a fragment or recipe')
    .option('--set <value>', 'Record a score (0.0 - 1.0)')
    .option('--note <text>', 'Optional note to attach to the score')
    .option('--trend', 'Show ASCII trend chart')
    .action(async (name: string, opts: { set?: string; note?: string; trend?: boolean }) => {
      try {
        if (opts.set !== undefined) {
          const value = parseFloat(opts.set);

          if (isNaN(value) || value < 0 || value > 1) {
            throw new ValidationError(
              'Score value must be between 0.0 and 1.0',
              'Example: aiwright score my-fragment --set 0.85',
            );
          }

          const result = await recordScore(name, value, opts.note);

          console.log(chalk.green('✔') + ` Recorded score for ${chalk.bold(name)}`);
          console.log(chalk.dim(`  value: ${value}  timestamp: ${result.timestamp}`));
          if (opts.note) {
            console.log(chalk.dim(`  note: ${opts.note}`));
          }

          // Record usage event (비침습적, 실패해도 무시)
          try {
            await recordUsageEvent({
              event_id: randomUUID(),
              event_type: 'score',
              timestamp: result.timestamp,
              recipe: name,
              fragments: [],
              adapter: result.adapter ?? 'generic',
              domain_tags: [],
              prompt_metrics: {
                total_chars: 0,
                slot_count: 0,
                has_constraint: false,
                has_example: false,
                has_context: false,
                context_chars: 0,
                variable_count: 0,
                variable_filled: 0,
                sentence_count: 0,
                imperative_ratio: 0,
              },
              outcome: { score: value },
            });
          } catch {
            // 이벤트 기록 실패는 score 결과에 영향을 주지 않음
          }

          return;
        }

        if (opts.trend) {
          const trend = await getOverallTrend(name);

          if (trend.length === 0) {
            console.log(chalk.yellow(`No score history for "${name}"`));
            console.log(chalk.dim('  Use `aiwright score <name> --set <value>` to record a score'));
            return;
          }

          console.log(chalk.bold(`\nTrend: ${name}`));
          console.log(chalk.dim(`Last ${trend.length} score(s)\n`));
          console.log(renderAsciiChart(trend));
          console.log('');
          return;
        }

        // Default: list history
        const history = await readHistory(name);

        if (history.length === 0) {
          console.log(chalk.yellow(`No score history for "${name}"`));
          console.log(chalk.dim('  Use `aiwright score <name> --set <value>` to record a score'));
          return;
        }

        console.log(chalk.bold(`\nScore history: ${name}`));
        console.log(chalk.dim('─'.repeat(60)));

        // Show in reverse chronological order
        const sorted = [...history].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        for (const entry of sorted) {
          const overall = entry.overall.toFixed(3);
          const color =
            entry.overall >= 0.8 ? chalk.green : entry.overall >= 0.6 ? chalk.yellow : chalk.red;
          const ts = new Date(entry.timestamp).toLocaleString();

          console.log(`  ${color(overall)}  ${chalk.dim(ts)}`);

          for (const m of entry.metrics) {
            let note = '';
            if (m.rationale) note = chalk.dim(` — ${m.rationale}`);
            console.log(`    ${chalk.dim(m.name)}: ${m.value.toFixed(3)}${note}`);
          }
        }

        console.log(chalk.dim('─'.repeat(60)));
        const avg = history.reduce((s, r) => s + r.overall, 0) / history.length;
        console.log(chalk.dim(`${history.length} record(s) — avg: ${avg.toFixed(3)}`));
        console.log('');
      } catch (err) {
        if (err instanceof RangeError) {
          throw new CommandError(err.message, 2);
        }
        throw err;
      }
    });
}
