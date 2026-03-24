import type { FragmentFile } from '../schema/fragment.js';
import { computeHeuristics } from '../scoring/heuristic.js';

export interface OptimizationResult {
  best_combination: string[];
  best_score: number;
  iterations: number;
  history: Array<{
    combination: string[];
    score: number;
  }>;
  improvement: number;
}

export interface OptimizeOptions {
  available_fragments: string[];
  current_recipe_fragments: string[];
  max_iterations?: number;
  target_metric?: string;
}

/**
 * FragmentFile[] 중에서 names에 해당하는 것만 필터링
 */
function filterByNames(fragments: FragmentFile[], names: string[]): FragmentFile[] {
  const nameSet = new Set(names);
  return fragments.filter((f) => nameSet.has(f.meta.name));
}

/**
 * 조합의 conflicts_with 위반 여부 검사
 * - 조합 내 어떤 Fragment A가 conflicts_with B를 포함하고 B도 조합에 있으면 위반
 */
function hasConflict(fragments: FragmentFile[], combination: string[]): boolean {
  const comboSet = new Set(combination);
  for (const frag of fragments) {
    if (!comboSet.has(frag.meta.name)) continue;
    for (const conflict of frag.meta.conflicts_with) {
      if (comboSet.has(conflict)) return true;
    }
  }
  return false;
}

/**
 * 조합의 heuristic score 계산 (3개 메트릭 단순 평균)
 */
function scoreCombo(
  allFragments: FragmentFile[],
  combination: string[],
  targetMetric: string,
): number {
  if (combination.length === 0) return 0;

  const active = filterByNames(allFragments, combination);
  const metrics = computeHeuristics(active);

  if (targetMetric === 'overall') {
    const sum = metrics.reduce((s, m) => s + m.value, 0);
    return metrics.length > 0 ? sum / metrics.length : 0;
  }

  const target = metrics.find((m) => m.name === targetMetric);
  return target?.value ?? 0;
}

/**
 * Hill-climbing neighborhood search 기반 Fragment 조합 최적화 (MIPROv2의 조합 탐색 개념 참고)
 *
 * 알고리즘:
 * 1. 현재 조합의 heuristic score를 기준선으로
 * 2. 각 iteration에서 mutation (교체/추가/제거)
 * 3. conflicts_with 위반 안 하는 후보만
 * 4. score 개선 시 채택, 3회 연속 개선 없으면 조기 종료
 */
export function optimizeCombination(
  fragments: FragmentFile[],
  options: OptimizeOptions,
): OptimizationResult {
  const {
    current_recipe_fragments,
    available_fragments,
    max_iterations = 20,
    target_metric = 'overall',
  } = options;

  // 사용 가능한 Fragment 이름 집합 (allFragments 기준으로 교차 필터링)
  const knownNames = new Set(fragments.map((f) => f.meta.name));
  const availableSet = available_fragments.filter((n) => knownNames.has(n));

  // 초기 조합: current_recipe_fragments 중 known한 것만
  let bestCombo = current_recipe_fragments.filter((n) => knownNames.has(n));
  let bestScore = scoreCombo(fragments, bestCombo, target_metric);
  const baselineScore = bestScore;

  const history: Array<{ combination: string[]; score: number }> = [
    { combination: [...bestCombo], score: bestScore },
  ];

  let noImprovementStreak = 0;
  let iterCount = 0;

  for (let i = 0; i < max_iterations; i++) {
    iterCount++;

    // mutation 후보 생성: replace / add / remove 중 하나
    const candidates: string[][] = [];

    // replace: bestCombo의 각 요소를 다른 available로 교체
    for (let idx = 0; idx < bestCombo.length; idx++) {
      for (const candidate of availableSet) {
        if (bestCombo.includes(candidate)) continue;
        const newCombo = [...bestCombo];
        newCombo[idx] = candidate;
        if (!hasConflict(fragments, newCombo)) {
          candidates.push(newCombo);
        }
      }
    }

    // add: bestCombo에 없는 available Fragment 추가
    for (const candidate of availableSet) {
      if (!bestCombo.includes(candidate)) {
        const newCombo = [...bestCombo, candidate];
        if (!hasConflict(fragments, newCombo)) {
          candidates.push(newCombo);
        }
      }
    }

    // remove: bestCombo에서 1개 제거 (최소 1개는 남김)
    if (bestCombo.length > 1) {
      for (let idx = 0; idx < bestCombo.length; idx++) {
        const newCombo = bestCombo.filter((_, j) => j !== idx);
        if (!hasConflict(fragments, newCombo)) {
          candidates.push(newCombo);
        }
      }
    }

    if (candidates.length === 0) {
      noImprovementStreak++;
      if (noImprovementStreak >= 3) break;
      continue;
    }

    // 모든 후보 중 최고 score 선택
    let bestCandidateCombo: string[] = [];
    let bestCandidateScore = -1;
    for (const combo of candidates) {
      const s = scoreCombo(fragments, combo, target_metric);
      if (s > bestCandidateScore) {
        bestCandidateScore = s;
        bestCandidateCombo = combo;
      }
    }

    if (bestCandidateScore > bestScore) {
      bestCombo = bestCandidateCombo;
      bestScore = bestCandidateScore;
      history.push({ combination: [...bestCombo], score: bestScore });
      noImprovementStreak = 0;
    } else {
      noImprovementStreak++;
      if (noImprovementStreak >= 3) break;
    }
  }

  const improvement =
    baselineScore > 0
      ? (bestScore - baselineScore) / baselineScore
      : bestScore > 0
        ? 1.0
        : 0;

  return {
    best_combination: bestCombo,
    best_score: bestScore,
    iterations: iterCount,
    history,
    improvement,
  };
}
