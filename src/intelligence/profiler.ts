import { type UsageEvent } from '../schema/usage-event.js';
import { type PromptStyle, type DomainStats } from '../schema/user-profile.js';

/**
 * 이벤트 목록에서 6축 PromptStyle 집계
 */
export function computeStyle(events: UsageEvent[]): PromptStyle {
  if (events.length === 0) {
    return {
      verbosity: 0,
      specificity: 0,
      context_ratio: 0,
      constraint_usage: 0,
      example_usage: 0,
      imperative_clarity: 0,
    };
  }

  const n = events.length;

  // verbosity: 평균 total_chars / 4000 (클램프 0~1)
  const avgChars = events.reduce((s, e) => s + e.prompt_metrics.total_chars, 0) / n;
  const verbosity = Math.min(1, avgChars / 4000);

  // specificity: variable_filled / variable_count 평균
  // variable_count가 0인 이벤트는 1.0 (변수 없음 = 완전 구체)으로 처리
  const specificityValues = events.map((e) => {
    const { variable_count, variable_filled } = e.prompt_metrics;
    if (variable_count === 0) return 1.0;
    return variable_filled / variable_count;
  });
  const specificity = specificityValues.reduce((s, v) => s + v, 0) / n;

  // context_ratio: context slot 사용 빈도
  const context_ratio = events.filter((e) => e.prompt_metrics.has_context).length / n;

  // constraint_usage: constraint slot 사용 빈도
  const constraint_usage = events.filter((e) => e.prompt_metrics.has_constraint).length / n;

  // example_usage: example slot 사용 빈도
  const example_usage = events.filter((e) => e.prompt_metrics.has_example).length / n;

  // imperative_clarity: 명령형 비율 평균
  const imperative_clarity =
    events.reduce((s, e) => s + e.prompt_metrics.imperative_ratio, 0) / n;

  return {
    verbosity,
    specificity,
    context_ratio,
    constraint_usage,
    example_usage,
    imperative_clarity,
  };
}

/**
 * 6축 스타일을 Prompt DNA 코드로 변환
 * 형식: AW-{축1}{값1}{축2}{값2}{축3}{값3}
 * 알고리즘: |value - 0.5|가 큰 순서 Top 3 선택 → quantile(0-9) 인코딩
 */
export function generateDnaCode(style: PromptStyle): string {
  const axes: Array<{ key: string; value: number }> = [
    { key: 'V', value: style.verbosity },
    { key: 'S', value: style.specificity },
    { key: 'X', value: style.context_ratio },
    { key: 'R', value: style.constraint_usage },
    { key: 'E', value: style.example_usage },
    { key: 'I', value: style.imperative_clarity },
  ];

  // |value - 0.5| 큰 순 Top 3 선택
  const sorted = [...axes].sort((a, b) => Math.abs(b.value - 0.5) - Math.abs(a.value - 0.5));
  const top3 = sorted.slice(0, 3);

  // quantile 인코딩: 0~1 → 0~9 (Math.round(value * 9))
  const encoded = top3.map(({ key, value }) => {
    const q = Math.round(Math.min(1, Math.max(0, value)) * 9);
    return `${key}${q}`;
  });

  return `AW-${encoded.join('')}`;
}

/**
 * 이벤트 목록에서 도메인별 통계 집계
 */
export function aggregateDomains(events: UsageEvent[]): DomainStats[] {
  const domainMap = new Map<string, UsageEvent[]>();

  for (const event of events) {
    for (const tag of event.domain_tags) {
      if (!domainMap.has(tag)) domainMap.set(tag, []);
      domainMap.get(tag)!.push(event);
    }
  }

  const result: DomainStats[] = [];

  for (const [domain, domainEvents] of domainMap.entries()) {
    const total_events = domainEvents.length;

    const scoreEvents = domainEvents.filter((e) => e.outcome?.score !== undefined);
    const avg_score =
      scoreEvents.length > 0
        ? scoreEvents.reduce((s, e) => s + (e.outcome?.score ?? 0), 0) / scoreEvents.length
        : 0;

    const ftrrEvents = domainEvents.filter((e) => e.outcome?.first_turn_resolved !== undefined);
    const ftrr =
      ftrrEvents.length > 0
        ? ftrrEvents.filter((e) => e.outcome?.first_turn_resolved === true).length /
          ftrrEvents.length
        : 0;

    const pcrEvents = domainEvents.filter((e) => e.outcome?.pcr !== undefined);
    const avg_pcr =
      pcrEvents.length > 0
        ? pcrEvents.reduce((s, e) => s + (e.outcome?.pcr ?? 0), 0) / pcrEvents.length
        : 0;

    result.push({ domain, total_events, avg_score, ftrr, avg_pcr });
  }

  return result;
}
