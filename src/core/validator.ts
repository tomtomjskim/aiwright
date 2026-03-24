import { FragmentFile } from '../schema/fragment.js';
import { Recipe } from '../schema/recipe.js';
import {
  CyclicDependencyError,
  FragmentConflictError,
  ValidationError,
} from '../utils/errors.js';

export interface ValidationWarning {
  type: 'override' | 'missing_var' | 'unknown_dep';
  message: string;
}

export interface RecipeValidationIssue {
  type: 'conflict' | 'cycle' | 'missing_required_var';
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: RecipeValidationIssue[];
  warnings: ValidationWarning[];
}

/**
 * Recipe의 Fragment 목록에 대해:
 * 1. depends_on DAG 순환 검증 (Kahn 알고리즘)
 * 2. conflicts_with 충돌 검출
 * 3. 필수 변수 누락 경고
 */
export function validateRecipe(
  recipe: Recipe | { fragments: Array<{ fragment: string; vars?: Record<string, unknown>; enabled?: boolean }> },
  fragments: FragmentFile[],
): ValidationResult {
  const errors: RecipeValidationIssue[] = [];
  const warnings: ValidationWarning[] = [];

  const fragmentMap = new Map<string, FragmentFile>(
    fragments.map((f) => [f.meta.name, f]),
  );

  const enabledNames = (recipe.fragments ?? [])
    .filter((e) => e.enabled !== false)
    .map((e) => e.fragment);

  const enabledSet = new Set(enabledNames);

  // 1. conflicts_with 충돌 검사
  for (const name of enabledNames) {
    const frag = fragmentMap.get(name);
    if (!frag) continue;
    for (const conflict of frag.meta.conflicts_with) {
      if (enabledSet.has(conflict)) {
        errors.push({
          type: 'conflict',
          message: `Fragment "${name}" conflicts with "${conflict}"`,
        });
      }
    }
  }

  // 2. DAG 순환 검사 (Kahn 알고리즘)
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const name of enabledNames) {
    graph.set(name, []);
    inDegree.set(name, 0);
  }

  for (const name of enabledNames) {
    const frag = fragmentMap.get(name);
    if (!frag) continue;
    for (const dep of frag.meta.depends_on) {
      if (!enabledSet.has(dep)) {
        warnings.push({
          type: 'unknown_dep',
          message: `Fragment "${name}" depends on "${dep}" which is not in the recipe`,
        });
        continue;
      }
      graph.get(dep)!.push(name);
      inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [name, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(name);
  }

  let processed = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    processed++;
    for (const neighbor of graph.get(node) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (processed < enabledNames.length) {
    // 사이클 존재 — 사이클 경로 찾기
    const remaining = enabledNames.filter((n) => (inDegree.get(n) ?? 0) > 0);
    errors.push({
      type: 'cycle',
      message: `Cyclic dependency detected among: ${remaining.join(', ')}`,
    });
  }

  // 3. 필수 변수 누락 경고
  const recipeVars = (recipe as { vars?: Record<string, unknown> }).vars ?? {};
  for (const entry of recipe.fragments ?? []) {
    if (entry.enabled === false) continue;
    const frag = fragmentMap.get(entry.fragment);
    if (!frag) continue;
    const entryVars = entry.vars ?? {};
    for (const [varName, varDef] of Object.entries(frag.meta.variables)) {
      if (varDef.required) {
        const provided =
          varName in entryVars ||
          varName in recipeVars ||
          varDef.default !== undefined;
        if (!provided) {
          warnings.push({
            type: 'missing_var',
            message: `Required variable "${varName}" in fragment "${entry.fragment}" has no value`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 검증 결과에서 첫 번째 에러를 throw
 */
export function assertValid(result: ValidationResult): void {
  if (result.valid) return;
  const first = result.errors[0];
  if (first.type === 'cycle') {
    throw new CyclicDependencyError([first.message]);
  }
  if (first.type === 'conflict') {
    const match = first.message.match(/"([^"]+)" conflicts with "([^"]+)"/);
    if (match) throw new FragmentConflictError(match[1], match[2]);
  }
  throw new ValidationError(first.message);
}
