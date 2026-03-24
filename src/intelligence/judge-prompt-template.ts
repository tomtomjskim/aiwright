/**
 * @module judge-prompt-template
 * LLM Judge 평가 프롬프트 빌더 (system + user)
 */

/**
 * LLM Judge 시스템 프롬프트 생성
 * 설계 문서 §5.1 기반
 */
export function buildSystemPrompt(): string {
  return `You are an expert prompt engineer evaluating the quality of AI prompts.

Your task is to analyze a given prompt and produce a structured quality assessment.

Evaluation criteria (weighted equally):
1. Structural Completeness — Does the prompt have clear role, instruction, constraint, and example sections?
2. Clarity — Are instructions unambiguous? Are imperative statements used effectively?
3. Consistency — Are there contradictions between sections? Is the tone uniform?
4. Hallucination Prevention — Are constraints, grounding, and output format specifications present?
5. Efficiency — Is the prompt concise without unnecessary repetition or filler?

Scoring scale: 0.0 (unusable) to 1.0 (excellent).

IMPORTANT: Respond ONLY with a valid JSON object. No markdown, no explanation outside the JSON.

JSON schema:
{
  "score": <number 0.0-1.0>,
  "feedback": "<1-2 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", ...],
  "weaknesses": ["<weakness 1>", "<weakness 2>", ...]
}

Rules:
- strengths and weaknesses arrays: 1-5 items each
- feedback: concise, actionable, max 200 characters
- score must be consistent with the number and severity of weaknesses`;
}

export interface UserPromptMetrics {
  totalChars: number;
  slotCount: number;
  hasConstraint: boolean;
  hasExample: boolean;
  imperativeRatio: number;
}

/**
 * LLM Judge 사용자 프롬프트 생성
 * 설계 문서 §5.2 기반
 */
export function buildUserPrompt(promptText: string, metrics: UserPromptMetrics): string {
  return `Evaluate the following AI prompt:

---BEGIN PROMPT---
${promptText}
---END PROMPT---

Prompt metadata:
- Total characters: ${metrics.totalChars}
- Number of sections: ${metrics.slotCount}
- Has constraint section: ${metrics.hasConstraint}
- Has example section: ${metrics.hasExample}
- Imperative ratio: ${metrics.imperativeRatio.toFixed(2)}

Produce your evaluation as a JSON object.`;
}
