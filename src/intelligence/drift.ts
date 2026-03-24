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
  time_window_triggered: boolean;
  window_days?: number;
  window_avg?: number;
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
 * 기준 시각으로부터 windowDays 이내의 scored 이벤트 필터링
 */
function getScoredEventsInWindow(
  events: UsageEvent[],
  recipeName: string,
  windowDays: number,
  now: Date = new Date(),
): UsageEvent[] {
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  return events
    .filter(
      (e) =>
        e.recipe === recipeName &&
        e.outcome?.score !== undefined &&
        new Date(e.timestamp) >= cutoff,
    )
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

interface WindowDriftResult {
  level: DriftLevel;
  windowDays: number;
  windowAvg: number;
}

/**
 * 시간 윈도우 기반 drift level 계산
 *
 * - Warning:      최근 7일 평균 < 0.5 (최소 2개)
 * - Adjustment:   최근 14일 평균 < 0.4 (최소 3개)
 * - Deactivation: 최근 30일 평균 < 0.3 (최소 4개)
 */
function detectWindowDrift(events: UsageEvent[], recipeName: string, now: Date = new Date()): WindowDriftResult {
  const windows: Array<{ days: number; threshold: number; minCount: number; level: DriftLevel }> = [
    { days: 30, threshold: 0.3, minCount: 4, level: 'deactivation' },
    { days: 14, threshold: 0.4, minCount: 3, level: 'adjustment' },
    { days: 7,  threshold: 0.5, minCount: 2, level: 'warning' },
  ];

  for (const { days, threshold, minCount, level } of windows) {
    const windowEvents = getScoredEventsInWindow(events, recipeName, days, now);
    const scores = windowEvents.map((e) => e.outcome!.score as number);
    if (scores.length >= minCount) {
      const windowAvg = avg(scores);
      if (windowAvg < threshold) {
        return { level, windowDays: days, windowAvg };
      }
    }
  }

  return { level: 'none', windowDays: 0, windowAvg: 0 };
}

const DRIFT_LEVEL_ORDER: Record<DriftLevel, number> = {
  none: 0,
  warning: 1,
  adjustment: 2,
  deactivation: 3,
};

/**
 * Recipe의 Drift 상태 감지
 *
 * 연속 횟수 기반 규칙:
 * - Warning:      score < 0.5가 3회 연속
 * - Adjustment:   score < 0.4가 5회 연속
 * - Deactivation: score < 0.3가 7회 연속
 *
 * 시간 윈도우 기반 규칙 (OR):
 * - Warning:      최근 7일 평균 < 0.5 (최소 2개)
 * - Adjustment:   최근 14일 평균 < 0.4 (최소 3개)
 * - Deactivation: 최근 30일 평균 < 0.3 (최소 4개)
 *
 * 둘 중 하나라도 만족하면 해당 level 트리거. 더 높은 level 우선.
 * trend: 최근 5회 평균 vs 이전 5회 평균 비교
 */
export function detectDrift(events: UsageEvent[], recipeName: string, now: Date = new Date()): DriftReport {
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

  // 연속 횟수 기반 Drift level 계산 (높은 심각도부터 확인)
  const consecutiveLow3 = countConsecutiveLow(scores, 0.5);
  const consecutiveLow4 = countConsecutiveLow(scores, 0.4);
  const consecutiveLow3_threshold = countConsecutiveLow(scores, 0.3);

  let consecutiveLevel: DriftLevel = 'none';
  let consecutiveLow = 0;

  if (consecutiveLow3_threshold >= 7) {
    consecutiveLevel = 'deactivation';
    consecutiveLow = consecutiveLow3_threshold;
  } else if (consecutiveLow4 >= 5) {
    consecutiveLevel = 'adjustment';
    consecutiveLow = consecutiveLow4;
  } else if (consecutiveLow3 >= 3) {
    consecutiveLevel = 'warning';
    consecutiveLow = consecutiveLow3;
  }

  // 시간 윈도우 기반 Drift level 계산
  const windowResult = detectWindowDrift(events, recipeName, now);

  // 두 결과 중 더 높은 level 채택
  const level: DriftLevel =
    DRIFT_LEVEL_ORDER[windowResult.level] > DRIFT_LEVEL_ORDER[consecutiveLevel]
      ? windowResult.level
      : consecutiveLevel;

  const timeWindowTriggered =
    windowResult.level !== 'none' &&
    DRIFT_LEVEL_ORDER[windowResult.level] >= DRIFT_LEVEL_ORDER[consecutiveLevel];

  let message = `Recipe "${recipeName}" is performing normally.`;
  let suggestion: string | undefined;

  if (level === 'deactivation') {
    if (timeWindowTriggered && windowResult.level === 'deactivation') {
      message = `Average score ${windowResult.windowAvg.toFixed(2)} below 0.3 over last ${windowResult.windowDays} days`;
    } else {
      message = `${consecutiveLow} consecutive scores below 0.3`;
    }
    suggestion = `Consider disabling the "${recipeName}" recipe. It has shown persistent poor performance. Run \`aiwright lint ${recipeName}\` for diagnosis.`;
  } else if (level === 'adjustment') {
    if (timeWindowTriggered && windowResult.level === 'adjustment') {
      message = `Average score ${windowResult.windowAvg.toFixed(2)} below 0.4 over last ${windowResult.windowDays} days`;
    } else {
      message = `${consecutiveLow} consecutive scores below 0.4`;
    }
    suggestion = `The "${recipeName}" recipe needs adjustment. Review fragment composition and run \`aiwright lint ${recipeName}\` to identify issues.`;
  } else if (level === 'warning') {
    if (timeWindowTriggered && windowResult.level === 'warning') {
      message = `Average score ${windowResult.windowAvg.toFixed(2)} below 0.5 over last ${windowResult.windowDays} days`;
    } else {
      message = `${consecutiveLow} consecutive scores below 0.5`;
    }
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
    time_window_triggered: timeWindowTriggered,
    ...(timeWindowTriggered && windowResult.level !== 'none'
      ? { window_days: windowResult.windowDays, window_avg: windowResult.windowAvg }
      : {}),
  };
}
