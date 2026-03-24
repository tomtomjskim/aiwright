import { type PromptMetrics } from '../schema/usage-event.js';

/**
 * 프롬프트 정적 분석 — LLM 호출 없이 순수 텍스트 분석
 *
 * @param fullText  렌더링된 전체 프롬프트 텍스트
 * @param sections  slot → 텍스트 맵 (ComposedPrompt.sections)
 */
export function extractPromptMetrics(
  fullText: string,
  sections: Map<string, string>,
): PromptMetrics {
  const total_chars = fullText.length;
  const slot_count = sections.size;

  const has_constraint =
    sections.has('constraint') && (sections.get('constraint')?.trim().length ?? 0) > 0;
  const has_example =
    sections.has('example') && (sections.get('example')?.trim().length ?? 0) > 0;
  const has_context =
    sections.has('context') && (sections.get('context')?.trim().length ?? 0) > 0;
  const context_chars = sections.get('context')?.length ?? 0;

  // {{변수}} 패턴 분석
  // 렌더링 후에도 남아있는 {{...}} = 미채움 변수
  const allVarMatches = fullText.match(/\{\{[^{}]+\}\}/g) ?? [];
  const variable_count = allVarMatches.length;
  // 렌더링 후 텍스트에 남은 {{...}}는 미채움 → variable_filled = 0 (잔류 기준)
  // 렌더링 전 변수 개수를 알 수 없으므로 잔류=미채움, filled=0으로 산정
  const variable_filled = 0;

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
