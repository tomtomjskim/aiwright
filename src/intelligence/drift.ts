import { type UsageEvent } from '../schema/usage-event.js';

export type DriftLevel = 'none' | 'warning' | 'adjustment' | 'deactivation';

export interface DriftReport {
  recipe: string;
  level: DriftLevel;
  consecutive_low: number;
  avg_recent: number;
  avg_previous: number;
  trend: 'improving' | 'stable' | 'declining';
  message: string;
  suggestion?: string;
}

/**
 * recipe 이벤트에서 score가 있는 이벤트만 추출 (시간순)
 */
function getScoredEvents(events: UsageEvent[], recipeName: string): UsageEvent[] {
  return events
    .filter((e) => e.recipe === recipeName && e.outcome?.score !== undefined)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * 연속 저점수 횟수 계산 (끝에서부터)
 */
function countConsecutiveLow(scores: number[], threshold: number): number {
  let count = 0;
  for (let i = scores.length - 1; i >= 0; i--) {
    if (scores[i] < threshold) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * 배열의 평균 계산
 */
function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Recipe의 Drift 상태 감지
 *
 * 규칙:
 * - Warning: score < 0.5가 3회 연속
 * - Adjustment: score < 0.4가 5회 연속
 * - Deactivation: score < 0.3가 7회 연속
 * - trend: 최근 5회 평균 vs 이전 5회 평균 비교
 */
export function detectDrift(events: UsageEvent[], recipeName: string): DriftReport {
  const scored = getScoredEvents(events, recipeName);
  const scores = scored.map((e) => e.outcome!.score as number);

  // 평균 계산용 윈도우
  const recent5 = scores.slice(-5);
  const previous5 = scores.length >= 10 ? scores.slice(-10, -5) : scores.slice(0, Math.max(0, scores.length - 5));

  const avgRecent = avg(recent5);
  const avgPrevious = avg(previous5);

  // trend 계산 (previous 없으면 stable)
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (previous5.length > 0) {
    const diff = avgRecent - avgPrevious;
    if (diff > 0.05) {
      trend = 'improving';
    } else if (diff < -0.05) {
      trend = 'declining';
    }
  }

  // Drift level 계산 (높은 심각도부터 확인)
  const consecutiveLow3 = countConsecutiveLow(scores, 0.5);
  const consecutiveLow4 = countConsecutiveLow(scores, 0.4);
  const consecutiveLow3_threshold = countConsecutiveLow(scores, 0.3);

  let level: DriftLevel = 'none';
  let consecutiveLow = 0;
  let message = `Recipe "${recipeName}" is performing normally.`;
  let suggestion: string | undefined;

  if (consecutiveLow3_threshold >= 7) {
    level = 'deactivation';
    consecutiveLow = consecutiveLow3_threshold;
    message = `${consecutiveLow} consecutive scores below 0.3`;
    suggestion = `Consider disabling the "${recipeName}" recipe. It has shown persistent poor performance. Run \`aiwright lint ${recipeName}\` for diagnosis.`;
  } else if (consecutiveLow4 >= 5) {
    level = 'adjustment';
    consecutiveLow = consecutiveLow4;
    message = `${consecutiveLow} consecutive scores below 0.4`;
    suggestion = `The "${recipeName}" recipe needs adjustment. Review fragment composition and run \`aiwright lint ${recipeName}\` to identify issues.`;
  } else if (consecutiveLow3 >= 3) {
    level = 'warning';
    consecutiveLow = consecutiveLow3;
    message = `${consecutiveLow} consecutive scores below 0.5`;
    suggestion = `Review your "${recipeName}" recipe. Recent quality has dropped.\n  Run \`aiwright lint ${recipeName}\` to check for prompt smells.`;
  }

  return {
    recipe: recipeName,
    level,
    consecutive_low: consecutiveLow,
    avg_recent: avgRecent,
    avg_previous: avgPrevious,
    trend,
    message,
    suggestion,
  };
}
