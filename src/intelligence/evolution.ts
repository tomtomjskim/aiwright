import type { FragmentFile } from '../schema/fragment.js';
import type { PromptStyle, Weakness } from '../schema/user-profile.js';

export interface EvolutionResult {
  evolved_fragments: Array<{
    original: string;
    suggestion: string;
    improvement_type: 'strengthen' | 'clarify' | 'add_example' | 'make_imperative';
  }>;
  strategy_evolution: {
    current: string;
    suggested: string;
  };
}

/**
 * Fragment body의 문장들을 명령형으로 변환하는 제안 텍스트 생성
 */
function suggestMakeImperative(body: string): string {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 이미 명령형으로 시작하는 패턴
  const imperativePattern = /^(Always|Never|Do|Return|Ensure|Avoid|Use|Write|Follow|Be|Make)/i;

  const suggestions = lines.map((line) => {
    if (imperativePattern.test(line)) return line;
    // "You write" → "Always write" 등으로 변환 제안
    const softMatch = line.match(/^You\s+(\w+)/i);
    if (softMatch) {
      return `Always ${line.replace(/^You\s+/i, '')}`;
    }
    // "Should/Can/May/Will" 패턴
    const modalMatch = line.match(/^(Should|Can|May|Will)\s+/i);
    if (modalMatch) {
      return `Always ${line.replace(/^(Should|Can|May|Will)\s+/i, '')}`;
    }
    return line;
  });

  return suggestions.join('\n');
}

/**
 * Fragment body의 변수 자리에 구체적 값 예시 추가 제안
 */
function suggestClarify(body: string): string {
  // {{varName}} 패턴을 {{varName (e.g., "example_value")}} 로 변환 제안
  return body.replace(/\{\{(\s*\w+\s*)\}\}/g, (_, v) => {
    const varName = v.trim();
    return `{{${varName} (e.g., "specify_${varName}")}}`;
  });
}

/**
 * weakest PromptStyle 축 이름 반환
 */
function weakestAxis(style: PromptStyle): string {
  const axes: Array<[string, number]> = [
    ['constraint_usage', style.constraint_usage],
    ['imperative_clarity', style.imperative_clarity],
    ['specificity', style.specificity],
    ['example_usage', style.example_usage],
    ['verbosity', style.verbosity],
    ['context_ratio', style.context_ratio],
  ];
  return axes.reduce((min, cur) => (cur[1] < min[1] ? cur : min), axes[0])[0];
}

/**
 * PromptBreeder 영감 룰 기반 Fragment 진화 — LLM 없이 순수 정적 분석
 *
 * 각 Fragment에 대해 약점 기반 개선 제안 생성:
 * - imperative_clarity 낮음 → make_imperative
 * - specificity 낮음 → clarify
 * - example_usage === 0 → add_example
 * - constraint_usage 낮음 → strengthen (제약 추가 제안)
 */
export function evolveFragments(
  fragments: FragmentFile[],
  style: PromptStyle,
  weaknesses: Weakness[],
): EvolutionResult {
  const weaknessIds = new Set(weaknesses.map((w) => w.id));

  const evolved_fragments: EvolutionResult['evolved_fragments'] = [];

  for (const frag of fragments) {
    // W005: imperative_clarity < 0.3 → make_imperative 제안
    if (weaknessIds.has('W005') || style.imperative_clarity < 0.3) {
      const suggested = suggestMakeImperative(frag.body);
      if (suggested !== frag.body) {
        evolved_fragments.push({
          original: frag.meta.name,
          suggestion: suggested,
          improvement_type: 'make_imperative',
        });
        continue;
      }
    }

    // W002: specificity < 0.5 → clarify 제안 (변수 있는 경우만)
    if ((weaknessIds.has('W002') || style.specificity < 0.5) && /\{\{/.test(frag.body)) {
      evolved_fragments.push({
        original: frag.meta.name,
        suggestion: suggestClarify(frag.body),
        improvement_type: 'clarify',
      });
      continue;
    }

    // W004: example_usage === 0 → add_example 제안
    if (weaknessIds.has('W004') || style.example_usage === 0) {
      evolved_fragments.push({
        original: frag.meta.name,
        suggestion: `${frag.body}\n\nExample:\nInput: <describe input>\nOutput: <describe expected output>`,
        improvement_type: 'add_example',
      });
      continue;
    }

    // W001: constraint_usage < 0.2 → strengthen 제안
    if (weaknessIds.has('W001') || style.constraint_usage < 0.2) {
      evolved_fragments.push({
        original: frag.meta.name,
        suggestion: `${frag.body}\n\nNever repeat information the user already provided. Always follow the specified output format.`,
        improvement_type: 'strengthen',
      });
    }
  }

  // 전략 진화: 현재 프로파일 기반으로 메타 전략 생성
  const weak = weakestAxis(style);
  const weakValue = (style as Record<string, number>)[weak];

  const currentStrategy = buildCurrentStrategy(style);
  const suggestedStrategy = `Focus on ${weak} improvement — your weakest area is ${weak} (${weakValue.toFixed(2)}). Consider adding more ${axisAdvice(weak)}.`;

  return {
    evolved_fragments,
    strategy_evolution: {
      current: currentStrategy,
      suggested: suggestedStrategy,
    },
  };
}

/**
 * 현재 스타일 기반 전략 설명 생성
 */
function buildCurrentStrategy(style: PromptStyle): string {
  const strengths: string[] = [];

  if (style.constraint_usage >= 0.5) strengths.push('constraint-heavy');
  if (style.example_usage >= 0.5) strengths.push('example-rich');
  if (style.imperative_clarity >= 0.5) strengths.push('directive-focused');
  if (style.verbosity >= 0.5) strengths.push('verbose');
  if (style.specificity >= 0.7) strengths.push('highly-specific');

  if (strengths.length === 0) return 'General-purpose prompt style';
  return `${strengths.join(', ')} prompt strategy`;
}

/**
 * 축 이름에 따른 개선 조언
 */
function axisAdvice(axis: string): string {
  const advice: Record<string, string> = {
    constraint_usage: 'explicit constraints and output format rules',
    imperative_clarity: 'imperative directives (Always/Never/Do/Return)',
    specificity: 'concrete variable values and specific context',
    example_usage: 'few-shot examples in the example slot',
    verbosity: 'role, context, and output format descriptions',
    context_ratio: 'background context in the context slot',
  };
  return advice[axis] ?? 'structured prompt sections';
}
