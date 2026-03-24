import Mustache from 'mustache';
import { ComposedPrompt } from '../adapter/contract.js';

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

  // 프롬프트 텍스트에 HTML escape 불필요 — render 스코프 내에서만 비활성화
  const originalEscape = Mustache.escape;
  Mustache.escape = (text: string) => text;
  const renderText = (text: string) => Mustache.render(text, mergedVars);

  const newSections: Record<string, string> = {};
  for (const [key, val] of Object.entries(composed.sections)) {
    newSections[key] = renderText(val);
  }

  const result: ComposedPrompt = {
    ...composed,
    sections: newSections,
    fullText: renderText(composed.fullText),
    resolvedVars: mergedVars,
  };

  Mustache.escape = originalEscape;
  return result;
}
