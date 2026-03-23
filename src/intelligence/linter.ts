import { type PromptMetrics, type UsageEvent } from '../schema/usage-event.js';

export interface LintResult {
  id: string;
  name: string;
  severity: 'HIGH' | 'WARN' | 'INFO';
  message: string;
}

/**
 * Prompt Smell Linter — Phase 2a 정적 분석 8개 규칙
 *
 * @param fullText  렌더링된 전체 프롬프트 텍스트
 * @param sections  slot → 텍스트 맵
 * @param metrics   extractPromptMetrics() 결과
 */
export function lintComposed(
  fullText: string,
  sections: Map<string, string>,
  metrics: PromptMetrics,
): LintResult[] {
  const results: LintResult[] = [];

  // PS001: Missing Constraint — constraint slot 없음
  if (!metrics.has_constraint) {
    results.push({
      id: 'PS001',
      name: 'Missing Constraint',
      severity: 'HIGH',
      message:
        'constraint slot이 없습니다. 출력 형식, 금지 사항 등을 명시해 할루시네이션을 줄이세요.',
    });
  }

  // PS002: Too Short — total_chars < 100
  if (metrics.total_chars < 100) {
    results.push({
      id: 'PS002',
      name: 'Too Short',
      severity: 'WARN',
      message: `프롬프트가 너무 짧습니다 (${metrics.total_chars}자). 역할/맥락/지시를 추가하세요.`,
    });
  }

  // PS003: Too Long — total_chars > 8000
  if (metrics.total_chars > 8000) {
    results.push({
      id: 'PS003',
      name: 'Too Long',
      severity: 'WARN',
      message: `프롬프트가 너무 깁니다 (${metrics.total_chars}자). 핵심만 남기고 정리하세요.`,
    });
  }

  // PS004: No Role — system slot 없음
  const hasSystem =
    sections.has('system') && (sections.get('system')?.trim().length ?? 0) > 0;
  if (!hasSystem) {
    results.push({
      id: 'PS004',
      name: 'No Role',
      severity: 'WARN',
      message: 'system slot이 없습니다. AI에게 역할(persona)을 부여하면 응답 품질이 향상됩니다.',
    });
  }

  // PS005: Vague Variables — variable_filled/count < 0.5
  if (metrics.variable_count > 0) {
    const fillRate = metrics.variable_filled / metrics.variable_count;
    if (fillRate < 0.5) {
      results.push({
        id: 'PS005',
        name: 'Vague Variables',
        severity: 'HIGH',
        message: `변수 채움률이 낮습니다 (${metrics.variable_filled}/${metrics.variable_count}). {{변수명}}을 실제 값으로 채우세요.`,
      });
    }
  }

  // PS006: No Example — example slot 없음
  if (!metrics.has_example) {
    results.push({
      id: 'PS006',
      name: 'No Example',
      severity: 'INFO',
      message: 'example slot이 없습니다. Few-shot 예시를 추가하면 출력 일관성이 향상됩니다.',
    });
  }

  // PS007: Passive Voice — imperative_ratio < 0.2
  if (metrics.imperative_ratio < 0.2) {
    results.push({
      id: 'PS007',
      name: 'Passive Voice',
      severity: 'WARN',
      message: `명령형 문장 비율이 낮습니다 (${(metrics.imperative_ratio * 100).toFixed(0)}%). "Do", "Return", "Always" 등으로 시작하는 지시를 늘리세요.`,
    });
  }

  // PS008: Context Obesity — context chars / total > 0.6
  const contextText = sections.get('context') ?? '';
  if (metrics.total_chars > 0) {
    const contextRatio = contextText.length / metrics.total_chars;
    if (contextRatio > 0.6) {
      results.push({
        id: 'PS008',
        name: 'Context Obesity',
        severity: 'WARN',
        message: `context 섹션이 전체의 ${(contextRatio * 100).toFixed(0)}%를 차지합니다. 핵심 맥락만 남기고 토큰을 절약하세요.`,
      });
    }
  }

  // PS009: Contradicting Constraints — "always X"와 "never X" 동일 대상 감지
  const constraintText = sections.get('constraint') ?? '';
  if (constraintText.length > 0) {
    const alwaysMatches = [...constraintText.matchAll(/always\s+(\w+)/gi)].map((m) =>
      m[1].toLowerCase(),
    );
    const neverMatches = [...constraintText.matchAll(/never\s+(\w+)/gi)].map((m) =>
      m[1].toLowerCase(),
    );
    const alwaysSet = new Set(alwaysMatches);
    const conflicting = neverMatches.filter((w) => alwaysSet.has(w));
    if (conflicting.length > 0) {
      results.push({
        id: 'PS009',
        name: 'Contradicting Constraints',
        severity: 'HIGH',
        message: `constraint에 모순 지시가 있습니다: "${conflicting[0]}"에 대해 always/never가 동시에 존재합니다.`,
      });
    }
  }

  // PS010: Duplicate Lines — 같은 문장이 2회 이상 등장 (줄 단위 중복)
  const lines = fullText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    lineCounts.set(line, (lineCounts.get(line) ?? 0) + 1);
  }
  const duplicates = [...lineCounts.entries()].filter(([, count]) => count >= 2);
  if (duplicates.length > 0) {
    results.push({
      id: 'PS010',
      name: 'Duplicate Lines',
      severity: 'WARN',
      message: `중복 문장이 ${duplicates.length}개 발견되었습니다. 동일 내용이 반복되면 토큰을 낭비합니다.`,
    });
  }

  return results;
}

/**
 * 히스토리 기반 Linter — 이벤트 목록과 레시피명으로 패턴 분석
 *
 * PS011: 최근 5회 동일 recipe score < 0.5 연속
 * PS012: apply 10회+ but score 0회
 */
export function lintBehavior(events: UsageEvent[], recipeName: string): LintResult[] {
  const results: LintResult[] = [];

  // 해당 레시피 이벤트만 필터
  const recipeEvents = events.filter((e) => e.recipe === recipeName);

  // PS011: 최근 5회 동일 recipe score < 0.5 연속
  const scoreEvents = recipeEvents.filter((e) => e.outcome?.score !== undefined);
  if (scoreEvents.length >= 5) {
    const recent5 = scoreEvents.slice(-5);
    const allLow = recent5.every((e) => (e.outcome?.score ?? 1) < 0.5);
    if (allLow) {
      results.push({
        id: 'PS011',
        name: 'Persistent Low Score',
        severity: 'WARN',
        message: `레시피 "${recipeName}"의 최근 5회 점수가 모두 0.5 미만입니다. 프래그먼트 구성을 재검토하세요.`,
      });
    }
  }

  // PS012: apply 10회+ but score 0회
  const applyCount = recipeEvents.filter((e) => e.event_type === 'apply').length;
  const scoredCount = recipeEvents.filter((e) => e.outcome?.score !== undefined).length;
  if (applyCount >= 10 && scoredCount === 0) {
    results.push({
      id: 'PS012',
      name: 'No Score Recorded',
      severity: 'INFO',
      message: `레시피 "${recipeName}"을 ${applyCount}회 적용했지만 점수 기록이 없습니다. \`aiwright score\`로 결과를 측정하세요.`,
    });
  }

  return results;
}
