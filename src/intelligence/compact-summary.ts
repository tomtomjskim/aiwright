import chalk from 'chalk';
import type { ScoreBundle } from './auto-score.js';
import type { LintResult } from './linter.js';
import type { Weakness } from '../schema/user-profile.js';

export interface SummaryData {
  recipeName: string;
  fragmentCount: number;
  outputPaths: string[];
  dnaCode: string;
  score: ScoreBundle;
  lintResults: LintResult[];
  weaknesses: Weakness[];
  quiet?: boolean;
}

/**
 * lint 요약 문자열 반환
 * - 결과 없음 → "clean"
 * - HIGH 있음 → "HIGH:N" (N개)
 * - WARN만 있음 → "WARN:N"
 * - INFO만 있음 → "INFO:N"
 */
function lintSummary(lintResults: LintResult[]): string {
  if (lintResults.length === 0) return 'clean';
  const highCount = lintResults.filter((r) => r.severity === 'HIGH').length;
  const warnCount = lintResults.filter((r) => r.severity === 'WARN').length;
  const infoCount = lintResults.filter((r) => r.severity === 'INFO').length;

  if (highCount > 0) return `HIGH:${String(highCount)}`;
  if (warnCount > 0) return `WARN:${String(warnCount)}`;
  return `INFO:${String(infoCount)}`;
}

/**
 * apply 결과 compact 출력
 *
 * normal 모드 (2-3줄):
 * ```
 * ✔ Applied "default" (7 fragments) → .claude/CLAUDE.md
 *   DNA: AW-S9E0I1 | Score: 0.82 | Lint: clean
 *   Tip: Add example slot to improve consistency
 * ```
 *
 * quiet 모드 (1줄, hook용):
 * ```
 * [aiwright] default → 0.82 | AW-S9E0I1 | clean
 * ```
 */
export function printCompactSummary(data: SummaryData): void {
  const { recipeName, fragmentCount, outputPaths, dnaCode, score, lintResults, quiet } = data;
  const lint = lintSummary(lintResults);
  const scoreStr = score.final.toFixed(2);

  if (quiet) {
    // 1줄 출력 (hook용)
    console.log(`[aiwright] ${recipeName} → ${scoreStr} | ${dnaCode} | ${lint}`);
    return;
  }

  // 첫 줄: 적용된 레시피 + fragment 수 + 출력 경로
  const outputStr = outputPaths.length > 0 ? ` → ${outputPaths[0]}` : '';
  console.log(
    chalk.green('✔') +
      ` Applied "${chalk.bold(recipeName)}" (${String(fragmentCount)} fragments)${outputStr}`,
  );

  // 두 번째 줄: DNA + Score + Lint
  const lintColor =
    lint === 'clean' ? chalk.green(lint) : lint.startsWith('HIGH') ? chalk.red(lint) : chalk.yellow(lint);
  console.log(
    chalk.dim(
      `  DNA: ${chalk.cyan(dnaCode)} | Score: ${chalk.bold(scoreStr)} | Lint: `,
    ) + lintColor,
  );

  // 세 번째 줄: Tip (있을 때만)
  if (data.score.tip) {
    console.log(chalk.dim(`  Tip: ${data.score.tip}`));
  }
}
