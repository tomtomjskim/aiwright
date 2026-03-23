import { type UserProfile } from '../schema/user-profile.js';

export interface AdaptAction {
  type: 'inject' | 'suppress';
  fragment: string;
  reason: string;
}

type FragmentEntry = {
  fragment: string;
  enabled?: boolean;
  vars?: Record<string, unknown>;
};

/**
 * 사용자 프로파일 기반으로 fragment 목록을 적응형 조정
 *
 * 룰:
 * - constraint_usage < 0.2 → constraint-no-hallucination inject
 * - example_usage === 0 → output-markdown inject
 * - profile.adaptive.rules[] 순회
 */
export function adaptFragments(
  entries: FragmentEntry[],
  profile: UserProfile,
): { entries: FragmentEntry[]; actions: AdaptAction[] } {
  // adaptive 비활성화 시 원본 반환
  if (!profile.adaptive?.enabled) {
    return { entries, actions: [] };
  }

  const actions: AdaptAction[] = [];
  const existingFragments = new Set(entries.map((e) => e.fragment));
  const newEntries: FragmentEntry[] = [...entries];

  // 룰 1: constraint_usage < 0.2 → inject constraint-no-hallucination
  if (profile.style.constraint_usage < 0.2) {
    const targetFragment = 'constraint-no-hallucination';
    if (!existingFragments.has(targetFragment)) {
      newEntries.push({ fragment: targetFragment, enabled: true });
      existingFragments.add(targetFragment);
      actions.push({
        type: 'inject',
        fragment: targetFragment,
        reason: `constraint_usage=${profile.style.constraint_usage.toFixed(2)} < 0.2 — 할루시네이션 방지 fragment 자동 추가`,
      });
    }
  }

  // 룰 2: example_usage === 0 → inject output-markdown
  if (profile.style.example_usage === 0) {
    const targetFragment = 'output-markdown';
    if (!existingFragments.has(targetFragment)) {
      newEntries.push({ fragment: targetFragment, enabled: true });
      existingFragments.add(targetFragment);
      actions.push({
        type: 'inject',
        fragment: targetFragment,
        reason: `example_usage=0 — 출력 형식 명확화 fragment 자동 추가`,
      });
    }
  }

  // 사용자 정의 rules 순회
  for (const rule of profile.adaptive.rules ?? []) {
    if (!existingFragments.has(rule.inject)) {
      // when 조건 평가: 현재는 문자열 조건 형태로 저장됨 (향후 확장 가능)
      // 간단히 inject 대상이 없는 경우 추가
      newEntries.push({ fragment: rule.inject, enabled: true });
      existingFragments.add(rule.inject);
      actions.push({
        type: 'inject',
        fragment: rule.inject,
        reason: rule.reason,
      });
    }
  }

  return { entries: newEntries, actions };
}
