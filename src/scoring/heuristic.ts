import type { FragmentFile } from '../schema/fragment.js';
import type { MetricValue } from '../schema/score.js';

/**
 * structural_completeness:
 * - system AND instruction slots present → 1.0
 * - exactly one of them present → 0.5
 * - neither present → 0.0
 */
function structuralCompleteness(fragments: FragmentFile[]): MetricValue {
  const slots = new Set(fragments.map((f) => f.meta.slot));
  const hasSystem = slots.has('system');
  const hasInstruction = slots.has('instruction');

  let value: number;
  if (hasSystem && hasInstruction) {
    value = 1.0;
  } else if (hasSystem || hasInstruction) {
    value = 0.5;
  } else {
    value = 0.0;
  }

  return {
    name: 'structural_completeness',
    value,
    source: 'heuristic',
  };
}

/**
 * length_ratio:
 * sum of all fragment body character lengths / 2000, capped at 1.0
 */
function lengthRatio(fragments: FragmentFile[]): MetricValue {
  const totalChars = fragments.reduce((sum, f) => sum + f.body.length, 0);
  const value = Math.min(1.0, totalChars / 2000);

  return {
    name: 'length_ratio',
    value,
    source: 'heuristic',
  };
}

/**
 * variable_coverage:
 * proportion of declared variables that are actually used ({{varName}}) in body.
 * Returns 1.0 when no variables are declared (vacuously true).
 */
function variableCoverage(fragments: FragmentFile[]): MetricValue {
  let declared = 0;
  let used = 0;

  for (const fragment of fragments) {
    const varNames = Object.keys(fragment.meta.variables ?? {});
    declared += varNames.length;

    for (const varName of varNames) {
      // Mustache double-brace pattern: {{varName}}
      const pattern = new RegExp(`\\{\\{\\s*${escapeRegex(varName)}\\s*\\}\\}`, 'g');
      if (pattern.test(fragment.body)) {
        used++;
      }
    }
  }

  const value = declared === 0 ? 1.0 : used / declared;

  return {
    name: 'variable_coverage',
    value,
    source: 'heuristic',
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compute all three MVP heuristic metrics for a set of fragments.
 */
export function computeHeuristics(fragments: FragmentFile[]): MetricValue[] {
  return [
    structuralCompleteness(fragments),
    lengthRatio(fragments),
    variableCoverage(fragments),
  ];
}
