/**
 * @module llm-judge
 * LLM-as-Judge: heuristic / llm / hybrid 세 가지 모드 지원
 *
 * - heuristic: lint 결과와 메트릭 기반 시뮬레이션 (LLM 호출 없음, 기본값)
 * - llm: 실제 LLM API 호출 (Anthropic / OpenAI)
 * - hybrid: LLM 70% + heuristic 30% 블렌딩
 */

import { lintComposed } from './linter.js';
import { extractPromptMetrics } from './extract-metrics.js';
import { resolveProvider, resolveApiKey } from './providers/index.js';
import { computeCacheKey, readCache, writeCache } from './judge-cache.js';
import { checkBudget, recordCall } from './judge-budget.js';
import { buildSystemPrompt, buildUserPrompt } from './judge-prompt-template.js';

export interface JudgeResult {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  model: string;
}

export interface JudgeOptions {
  model?: string;
  mode?: 'heuristic' | 'llm' | 'hybrid';
  provider?: 'anthropic' | 'openai';
  apiKey?: string;
  apiKeyEnv?: string;
  cache?: boolean;
  cacheTtlHours?: number;
  timeoutMs?: number;
  dailyLimit?: number;
  monthlyLimit?: number;
}

/**
 * Quality Judge — mode 기반 라우터
 *
 * - mode 미지정 또는 'heuristic': 기존 heuristic simulation 동작 (하위호환)
 * - mode 'llm': 실제 LLM API 호출 (API 키 없으면 무경고 heuristic 폴백)
 * - mode 'hybrid': LLM 70% + heuristic 30% 블렌딩
 */
export async function judgePrompt(fullText: string, options?: JudgeOptions): Promise<JudgeResult> {
  const mode = options?.mode ?? 'heuristic';
  switch (mode) {
    case 'llm':
      return llmJudge(fullText, options!);
    case 'hybrid':
      return hybridJudge(fullText, options!);
    default:
      return heuristicJudge(fullText);
  }
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

/**
 * Heuristic Judge — lint 결과와 메트릭 기반 점수 산출 (LLM 호출 없음)
 * 기존 judgePrompt() 본문에서 추출
 */
async function heuristicJudge(fullText: string): Promise<JudgeResult> {
  const model = 'heuristic-sim-v1';

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
 * LLM Judge — 실제 LLM API 호출
 * API 키 미설정 시 무경고 heuristic 폴백
 * 예산 초과 또는 provider 에러 시 경고 후 heuristic 폴백
 */
async function llmJudge(fullText: string, options: JudgeOptions): Promise<JudgeResult> {
  const model = options.model ?? 'claude-haiku-4-5-20251001';

  // 1. API 키 해석
  const apiKey = resolveApiKey(options.apiKeyEnv ?? 'ANTHROPIC_API_KEY', options.apiKey);
  if (!apiKey) return heuristicJudge(fullText); // 무경고 폴백

  // 2. 캐시 확인 (예산 소모 없이 결과 반환 가능)
  if (options.cache !== false) {
    const hash = computeCacheKey(fullText, model);
    const cached = await readCache(hash);
    if (cached) {
      return { ...cached.result, model: `${cached.result.model} (cached)` };
    }
  }

  // 3. 예산 확인 (캐시 미스 시에만 도달)
  if (options.dailyLimit && options.dailyLimit > 0) {
    const budget = await checkBudget(options.dailyLimit, options.monthlyLimit ?? 500);
    if (!budget.allowed) {
      console.warn(`[aiwright] Budget exceeded: ${budget.reason}`);
      return heuristicJudge(fullText);
    }
  }

  // 4. Provider 호출
  try {
    const provider = resolveProvider(options.provider ?? 'anthropic', apiKey);
    const sections = parseSections(fullText);
    const metrics = extractPromptMetrics(fullText, sections);

    const response = await provider.judge({
      systemPrompt: buildSystemPrompt(),
      prompt: buildUserPrompt(fullText, {
        totalChars: metrics.total_chars,
        slotCount: metrics.slot_count,
        hasConstraint: metrics.has_constraint,
        hasExample: metrics.has_example,
        imperativeRatio: metrics.imperative_ratio,
      }),
      model,
      timeoutMs: options.timeoutMs ?? 30000,
    });

    const result: JudgeResult = {
      score: Math.max(0, Math.min(1, response.score)),
      feedback: response.feedback,
      strengths: response.strengths.slice(0, 5),
      weaknesses: response.weaknesses.slice(0, 5),
      model,
    };

    // 5. 캐시 저장 + 예산 기록
    if (options.cache !== false) {
      const hash = computeCacheKey(fullText, model);
      await writeCache({
        hash,
        result,
        created_at: new Date().toISOString(),
        ttl_hours: options.cacheTtlHours ?? 168,
        usage: response.usage,
      }).catch(() => {});
    }
    await recordCall(response.usage.input_tokens, response.usage.output_tokens, model).catch(() => {});

    return result;
  } catch (err) {
    console.warn(
      `[aiwright] LLM judge failed: ${err instanceof Error ? err.message : 'unknown'}, falling back to heuristic`,
    );
    return heuristicJudge(fullText);
  }
}

/**
 * 중복 제거 (대소문자/공백 무시)
 */
export function dedup(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Hybrid Judge — LLM 70% + heuristic 30% 블렌딩
 */
async function hybridJudge(fullText: string, options: JudgeOptions): Promise<JudgeResult> {
  // llmJudge는 내부적으로 모든 에러를 catch하여 heuristic 폴백하므로 throw하지 않음
  const llmResult = await llmJudge(fullText, options);
  const heuristicResult = await heuristicJudge(fullText);

  const score = Math.round((llmResult.score * 0.7 + heuristicResult.score * 0.3) * 100) / 100;

  // LLM 우선, 중복 제거, max 5
  const strengths = dedup([...llmResult.strengths, ...heuristicResult.strengths]).slice(0, 5);
  const weaknesses = dedup([...llmResult.weaknesses, ...heuristicResult.weaknesses]).slice(0, 5);

  return {
    score,
    feedback: llmResult.feedback,
    strengths,
    weaknesses,
    model: llmResult.model,
  };
}
