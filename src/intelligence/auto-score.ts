import { computeHeuristics } from '../scoring/heuristic.js';
import { judgePrompt } from './llm-judge.js';
import type { FragmentFile } from '../schema/fragment.js';
import type { LintResult } from './linter.js';

export interface ScoreBundle {
  heuristic: number;
  judge: number;
  final: number;
  model: string;
  tip: string | null;
}

/**
 * Fragment 집합 + 렌더링된 프롬프트를 기반으로 자동 점수 계산
 *
 * - heuristic: computeHeuristics() 메트릭의 평균
 * - judge: judgePrompt() score (실패 시 heuristic fallback)
 * - final: heuristic * 0.4 + judge * 0.6
 * - tip: HIGH lint → WARN lint → judge weakness[0] → null
 */
export async function computeAutoScore(
  fragmentFiles: FragmentFile[],
  fullText: string,
  sections: Map<string, string>,
  lintResults: LintResult[],
): Promise<ScoreBundle> {
  // heuristic: 메트릭 평균
  const metrics = computeHeuristics(fragmentFiles);
  const heuristic =
    metrics.length > 0
      ? metrics.reduce((s, m) => s + m.value, 0) / metrics.length
      : 0;

  // judge: LLM-as-judge (실패 시 heuristic fallback)
  let judge = heuristic;
  let model = 'heuristic-fallback';
  let judgeWeaknesses: string[] = [];

  try {
    const judgeResult = await judgePrompt(fullText);
    judge = judgeResult.score;
    model = judgeResult.model;
    judgeWeaknesses = judgeResult.weaknesses;
  } catch {
    // judge 실패 시 heuristic으로 fallback
    judge = heuristic;
    model = 'heuristic-fallback';
  }

  const final = Math.round((heuristic * 0.4 + judge * 0.6) * 100) / 100;

  // tip 결정: HIGH lint → WARN lint → judge weakness[0] → null
  const highLint = lintResults.find((r) => r.severity === 'HIGH');
  const warnLint = lintResults.find((r) => r.severity === 'WARN');

  let tip: string | null = null;
  if (highLint) {
    tip = highLint.message;
  } else if (warnLint) {
    tip = warnLint.message;
  } else if (judgeWeaknesses.length > 0) {
    tip = judgeWeaknesses[0];
  }

  return { heuristic, judge, final, model, tip };
}
