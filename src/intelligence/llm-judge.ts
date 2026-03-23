import { lintComposed } from './linter.js';
import { extractPromptMetrics } from './extract-metrics.js';

export interface JudgeResult {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  model: string;
}

/**
 * 시뮬레이션 모드 — 휴리스틱 + linter 결과를 자연어로 변환
 *
 * TODO: Replace with actual LLM API call
 * Example integration point:
 *   const response = await openai.chat.completions.create({
 *     model: options?.model ?? 'gpt-4o-mini',
 *     messages: [{ role: 'user', content: buildJudgePrompt(fullText) }],
 *   });
 *   return parseJudgeResponse(response.choices[0].message.content);
 */
export async function judgePrompt(
  fullText: string,
  options?: { model?: string },
): Promise<JudgeResult> {
  const model = options?.model ?? 'heuristic-sim-v1';

  // 섹션 파싱: 마커 기반 ([slot] ... [/slot] 또는 줄 단위 간이 파싱)
  const sections = parseSections(fullText);

  const metrics = extractPromptMetrics(fullText, sections);
  const lintResults = lintComposed(fullText, sections, metrics);

  const highIssues = lintResults.filter((r) => r.severity === 'HIGH');
  const warnIssues = lintResults.filter((r) => r.severity === 'WARN');
  const infoIssues = lintResults.filter((r) => r.severity === 'INFO');

  // 점수 계산: 기본 1.0에서 HIGH는 0.15, WARN은 0.07, INFO는 0.02 차감
  let score = 1.0;
  score -= highIssues.length * 0.15;
  score -= warnIssues.length * 0.07;
  score -= infoIssues.length * 0.02;
  score = Math.max(0, Math.min(1, score));
  score = Math.round(score * 100) / 100;

  // 강점 도출
  const strengths: string[] = [];
  if (metrics.has_constraint) strengths.push('Good constraint coverage');
  if (sections.has('system') && (sections.get('system')?.trim().length ?? 0) > 0) {
    strengths.push('Clear system role definition');
  }
  if (metrics.has_example) strengths.push('Includes few-shot examples');
  if (metrics.imperative_ratio >= 0.5) strengths.push('Strong imperative clarity');
  if (metrics.total_chars >= 200 && metrics.total_chars <= 4000) {
    strengths.push('Well-sized prompt (concise but complete)');
  }
  if (metrics.variable_count > 0 && metrics.variable_filled / metrics.variable_count >= 0.8) {
    strengths.push('High variable fill rate');
  }
  if (lintResults.length === 0) {
    strengths.push('No prompt smells detected');
    strengths.push('Excellent overall structure');
  }

  // 약점 도출 (lint 결과 기반)
  const weaknesses: string[] = [];
  for (const issue of highIssues) {
    weaknesses.push(mapLintToWeakness(issue.id, issue.name));
  }
  for (const issue of warnIssues) {
    weaknesses.push(mapLintToWeakness(issue.id, issue.name));
  }
  for (const issue of infoIssues) {
    weaknesses.push(mapLintToWeakness(issue.id, issue.name));
  }

  // 피드백 문장 생성
  const feedback = buildFeedback(score, strengths, weaknesses, highIssues.length, lintResults.length);

  return {
    score,
    feedback,
    strengths,
    weaknesses,
    model,
  };
}

/**
 * 전체 텍스트에서 섹션 맵 추출
 * [slot] ... 마커 또는 전체 텍스트를 단일 섹션으로 처리
 */
function parseSections(fullText: string): Map<string, string> {
  const sections = new Map<string, string>();

  // [slot] 마커 패턴 시도
  const slotPattern = /\[(\w+)\]([\s\S]*?)(?=\[\w+\]|$)/g;
  let match: RegExpExecArray | null;
  let found = false;

  while ((match = slotPattern.exec(fullText)) !== null) {
    sections.set(match[1].toLowerCase(), match[2].trim());
    found = true;
  }

  if (!found) {
    // 마커 없을 때 전체를 instruction으로 처리
    sections.set('instruction', fullText.trim());
  }

  return sections;
}

/**
 * lint ID → 사람이 읽기 쉬운 약점 설명
 */
function mapLintToWeakness(id: string, name: string): string {
  const map: Record<string, string> = {
    PS001: 'No constraint slot (hallucination risk)',
    PS002: 'Prompt too short — add role/context/instruction',
    PS003: 'Prompt too long — trim to essentials',
    PS004: 'No system role definition',
    PS005: 'Low variable fill rate (vague variables)',
    PS006: 'No example slot (few-shot missing)',
    PS007: 'Low imperative clarity',
    PS008: 'Context obesity — too much context relative to total',
    PS009: 'Contradicting constraints detected',
    PS010: 'Duplicate lines waste tokens',
    PS011: 'Persistent low score pattern',
    PS012: 'No scores recorded despite frequent use',
  };
  return map[id] ?? name;
}

/**
 * 점수 + 이슈 수 기반 피드백 문장 생성
 */
function buildFeedback(
  score: number,
  strengths: string[],
  weaknesses: string[],
  highCount: number,
  totalIssues: number,
): string {
  if (totalIssues === 0) {
    return 'Excellent prompt quality. No issues detected. This prompt demonstrates strong structure across all dimensions.';
  }

  if (score >= 0.8) {
    return `This prompt is well-structured with ${strengths.length} notable strengths. Minor improvements could further refine output consistency.`;
  }

  if (score >= 0.6) {
    const topWeakness = weaknesses[0] ?? 'structural gaps';
    return `This prompt has solid structure but needs attention in: ${topWeakness}. Addressing the listed weaknesses will significantly improve output quality.`;
  }

  if (highCount > 0) {
    return `This prompt has ${highCount} high-severity issue(s) that require immediate attention. Focus on resolving HIGH-severity items first for the biggest quality improvement.`;
  }

  return `This prompt requires significant revision. ${weaknesses.length} issue(s) detected. Consider restructuring with explicit role, constraint, and instruction sections.`;
}
