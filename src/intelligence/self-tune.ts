import { type UserProfile } from '../schema/user-profile.js';
import { type DriftReport } from './drift.js';
import { type JudgeResult } from './llm-judge.js';

export interface TuneAction {
  type: 'warn' | 'suggest_disable' | 'suggest_replace' | 'suggest_add';
  target: string;
  reason: string;
  replacement?: string;
}

/**
 * Drift 감지 결과 + LLM Judge 기반 자동 튜닝 제안 생성
 *
 * 규칙:
 * - drift.level === 'none' → 빈 배열
 * - drift.level === 'warning' → warn 액션
 * - drift.level === 'adjustment' + judge.weaknesses 있음 → suggest_replace (약한 Fragment 교체 제안)
 * - drift.level === 'deactivation' → suggest_disable (Recipe 비활성화 제안)
 * - judge.weaknesses에서 missing constraint → suggest_add
 */
export function generateTuneActions(
  drift: DriftReport,
  judgeResult: JudgeResult,
  profile: UserProfile,
): TuneAction[] {
  const actions: TuneAction[] = [];

  if (drift.level === 'none') {
    return actions;
  }

  // Deactivation: 비활성화 제안 (최고 심각도)
  if (drift.level === 'deactivation') {
    actions.push({
      type: 'suggest_disable',
      target: drift.recipe,
      reason: `Recipe "${drift.recipe}" has ${drift.consecutive_low} consecutive scores below 0.3. Persistent poor performance detected.`,
    });
  }

  // Adjustment: 약한 Fragment 교체 제안
  if (drift.level === 'adjustment' && judgeResult.weaknesses.length > 0) {
    // 약한 부분에서 교체 후보 추출
    const weakFragment = findWeakFragment(judgeResult.weaknesses, profile);
    if (weakFragment) {
      actions.push({
        type: 'suggest_replace',
        target: weakFragment.current,
        reason: `Fragment "${weakFragment.current}" is contributing to low scores: ${judgeResult.weaknesses[0]}`,
        replacement: weakFragment.replacement,
      });
    } else {
      // 특정 Fragment를 특정하기 어려운 경우 recipe 자체 교체 제안
      actions.push({
        type: 'suggest_replace',
        target: drift.recipe,
        reason: `Recipe "${drift.recipe}" has ${drift.consecutive_low} consecutive low scores. Weaknesses: ${judgeResult.weaknesses.slice(0, 2).join(', ')}`,
        replacement: `${drift.recipe}-v2`,
      });
    }
  }

  // Warning: 경고 액션
  if (drift.level === 'warning') {
    actions.push({
      type: 'warn',
      target: drift.recipe,
      reason: `Recipe "${drift.recipe}" shows declining performance: ${drift.message}. Trend: ${drift.trend}.`,
    });
  }

  // judge.weaknesses에서 constraint 부재 → suggest_add
  const hasMissingConstraint = judgeResult.weaknesses.some(
    (w) => w.toLowerCase().includes('constraint') || w.toLowerCase().includes('ps001'),
  );
  if (hasMissingConstraint) {
    actions.push({
      type: 'suggest_add',
      target: 'constraint',
      reason: 'No constraint slot detected. Adding a constraint fragment reduces hallucination risk.',
      replacement: 'constraint-no-hallucination',
    });
  }

  // judge.weaknesses에서 예시 부재 → suggest_add
  const hasMissingExample = judgeResult.weaknesses.some(
    (w) => w.toLowerCase().includes('example') || w.toLowerCase().includes('few-shot') || w.toLowerCase().includes('ps006'),
  );
  if (hasMissingExample) {
    actions.push({
      type: 'suggest_add',
      target: 'example',
      reason: 'No example slot detected. Adding few-shot examples improves output consistency.',
    });
  }

  return actions;
}

/**
 * 약점 목록과 프로파일에서 교체할 Fragment 후보 찾기
 */
function findWeakFragment(
  weaknesses: string[],
  profile: UserProfile,
): { current: string; replacement: string } | null {
  // 프로파일의 약점과 judge weaknesses를 교차 분석
  const profileWeakFragments = profile.weaknesses
    .filter((w) => w.fragment !== undefined)
    .map((w) => w.fragment as string);

  if (profileWeakFragments.length === 0) return null;

  // 가장 심각한 약점 Fragment 선택
  const highSeverity = profile.weaknesses.find((w) => w.severity === 'HIGH' && w.fragment);
  if (highSeverity?.fragment) {
    return {
      current: highSeverity.fragment,
      replacement: `${highSeverity.fragment}-improved`,
    };
  }

  const warnSeverity = profile.weaknesses.find((w) => w.severity === 'WARN' && w.fragment);
  if (warnSeverity?.fragment) {
    return {
      current: warnSeverity.fragment,
      replacement: `${warnSeverity.fragment}-v2`,
    };
  }

  return null;
}
