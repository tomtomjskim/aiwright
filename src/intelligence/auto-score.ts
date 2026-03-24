import { computeHeuristics } from '../scoring/heuristic.js';
import { judgePrompt, type JudgeOptions } from './llm-judge.js';
import type { FragmentFile } from '../schema/fragment.js';
import type { LintResult } from './linter.js';
import type { JudgeConfig } from '../schema/config.js';
import type { PromptMetrics } from '../schema/usage-event.js';

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
  sections: Record<string, string>,
  lintResults: LintResult[],
  judgeConfig?: JudgeConfig,
  promptMetrics?: PromptMetrics,
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
    const judgeOptions: JudgeOptions = {
      ...(judgeConfig
        ? {
            mode: judgeConfig.mode,
            model: judgeConfig.model,
            provider: judgeConfig.provider,
            apiKeyEnv: judgeConfig.api_key_env,
            cache: judgeConfig.cache,
            cacheTtlHours: judgeConfig.cache_ttl_hours,
            timeoutMs: judgeConfig.timeout_ms,
            dailyLimit: judgeConfig.daily_limit,
            monthlyLimit: judgeConfig.monthly_limit,
          }
        : {}),
      ...(promptMetrics
        ? { precomputed: { sections, metrics: promptMetrics, lintResults } }
        : {}),
    };
    const judgeResult = await judgePrompt(fullText, judgeOptions);
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
