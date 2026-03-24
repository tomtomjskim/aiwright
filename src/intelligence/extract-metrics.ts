import { type PromptMetrics } from '../schema/usage-event.js';

/**
 * 프롬프트 정적 분석 — LLM 호출 없이 순수 텍스트 분석
 *
 * @param fullText  렌더링된 전체 프롬프트 텍스트
 * @param sections  slot → 텍스트 맵 (ComposedPrompt.sections)
 */
export function extractPromptMetrics(
  fullText: string,
  sections: Record<string, string>,
  resolvedVars?: Record<string, unknown>,
): PromptMetrics {
  const total_chars = fullText.length;
  const slot_count = Object.keys(sections).length;

  const has_constraint =
    'constraint' in sections && (sections['constraint']?.trim().length ?? 0) > 0;
  const has_example =
    'example' in sections && (sections['example']?.trim().length ?? 0) > 0;
  const has_context =
    'context' in sections && (sections['context']?.trim().length ?? 0) > 0;
  const context_chars = sections['context']?.length ?? 0;

  // {{변수}} 패턴 분석
  // 렌더링 후에도 남아있는 {{...}} = 미채움 변수
  const allVarMatches = fullText.match(/\{\{[^{}]+\}\}/g) ?? [];
  const variable_count = allVarMatches.length;

  // resolvedVars가 제공된 경우: 전체 변수 수 - 미채움 수 = 채워진 수
  // 제공되지 않은 경우(heuristic judge 등): 미채움만 알 수 있으므로 0
  const totalVarCount = resolvedVars !== undefined ? Object.keys(resolvedVars).length : variable_count;
  const variable_filled = Math.max(0, totalVarCount - variable_count);

  // 문장 분리: 마침표/느낌표/물음표로 분리
  const sentences = fullText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const sentence_count = sentences.length;

  // 명령형 문장 감지: 특정 동사로 시작하는 문장
  const IMPERATIVE_STARTERS =
    /^(Do|Don't|Always|Never|Use|Avoid|Make|Ensure|Write|Return|Check)\b/i;

  const imperative_sentences = sentences.filter((s) => IMPERATIVE_STARTERS.test(s));
  const imperative_ratio =
    sentence_count > 0 ? imperative_sentences.length / sentence_count : 0;

  return {
    total_chars,
    slot_count,
    has_constraint,
    has_example,
    has_context,
    context_chars,
    variable_count,
    variable_filled,
    sentence_count,
    imperative_ratio,
  };
}
