import Mustache from 'mustache';
import { ComposedPrompt } from '../adapter/contract.js';

// Mustache escaping 비활성화 (프롬프트에 HTML 이스케이프 불필요)
Mustache.escape = (text: string) => text;

/**
 * ComposedPrompt의 fullText에서 {{변수}} 치환
 * 변수 우선순위: Fragment 기본값 < globalVars < recipeVars < entryVars
 */
export function render(
  composed: ComposedPrompt,
  recipeVars: Record<string, unknown>,
  globalVars: Record<string, unknown>,
): ComposedPrompt {
  const mergedVars: Record<string, unknown> = {
    ...composed.resolvedVars,
    ...globalVars,
    ...recipeVars,
  };

  const renderText = (text: string) => Mustache.render(text, mergedVars);

  const newSections = new Map<string, string>();
  for (const [key, val] of composed.sections.entries()) {
    newSections.set(key, renderText(val));
  }

  return {
    ...composed,
    sections: newSections,
    fullText: renderText(composed.fullText),
    resolvedVars: mergedVars,
  };
}
