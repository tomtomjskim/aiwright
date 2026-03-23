import { type UsageEvent } from '../schema/usage-event.js';
import { type GrowthSnapshot } from '../schema/user-profile.js';
import { computeStyle } from './profiler.js';

/**
 * 이벤트 목록을 월별(YYYY-MM)로 그룹핑하여 GrowthSnapshot[] 반환
 * 각 월의 style 집계 + avg_score + event_count
 */
export function computeGrowth(events: UsageEvent[]): GrowthSnapshot[] {
  if (events.length === 0) return [];

  // 월별 그룹핑
  const monthMap = new Map<string, UsageEvent[]>();

  for (const event of events) {
    const date = new Date(event.timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const period = `${year}-${month}`;

    if (!monthMap.has(period)) monthMap.set(period, []);
    monthMap.get(period)!.push(event);
  }

  // 월별 스냅샷 생성 (정렬: YYYY-MM 오름차순)
  const snapshots: GrowthSnapshot[] = [];

  const sortedPeriods = Array.from(monthMap.keys()).sort();

  for (const period of sortedPeriods) {
    const monthEvents = monthMap.get(period)!;
    const style = computeStyle(monthEvents);

    const scoreEvents = monthEvents.filter((e) => e.outcome?.score !== undefined);
    const overall_score =
      scoreEvents.length > 0
        ? scoreEvents.reduce((s, e) => s + (e.outcome?.score ?? 0), 0) / scoreEvents.length
        : 0;

    snapshots.push({
      period,
      style,
      overall_score,
      event_count: monthEvents.length,
    });
  }

  return snapshots;
}
