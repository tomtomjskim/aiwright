/**
 * @module judge-budget
 * LLM Judge 일일/월별 호출 카운트 및 비용 추정
 *
 * 예산 파일: ~/.aiwright/judge-budget.yaml
 * - 날짜 변경 시 daily_count 자동 리셋
 * - 월 변경 시 monthly_count 자동 리셋
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';

export interface BudgetState {
  daily_count: number;
  daily_date: string; // YYYY-MM-DD
  monthly_count: number;
  monthly_key: string; // YYYY-MM
  total_estimated_cost_usd: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string; // 'daily_limit_exceeded' | 'monthly_limit_exceeded'
  remaining_daily: number;
  remaining_monthly: number;
}

/** 모델별 비용 단가 (USD / 1M tokens) */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-sonnet-4-5-20250514': { input: 3.00, output: 15.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
};

/**
 * 예산 파일 경로 반환
 */
export function getBudgetPath(): string {
  return path.join(os.homedir(), '.aiwright', 'judge-budget.yaml');
}

/**
 * 오늘 날짜 (YYYY-MM-DD)
 */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 이번 달 키 (YYYY-MM)
 */
function thisMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

/** 빈 초기 상태 */
function defaultState(): BudgetState {
  return {
    daily_count: 0,
    daily_date: todayStr(),
    monthly_count: 0,
    monthly_key: thisMonthStr(),
    total_estimated_cost_usd: 0,
  };
}

/**
 * 예산 파일 읽기
 * 파일이 없으면 기본 상태 반환
 */
async function readBudget(budgetPath: string): Promise<BudgetState> {
  try {
    const raw = await fs.readFile(budgetPath, 'utf-8');
    const parsed = yaml.load(raw) as Partial<BudgetState>;
    return {
      daily_count: parsed.daily_count ?? 0,
      daily_date: parsed.daily_date ?? todayStr(),
      monthly_count: parsed.monthly_count ?? 0,
      monthly_key: parsed.monthly_key ?? thisMonthStr(),
      total_estimated_cost_usd: parsed.total_estimated_cost_usd ?? 0,
    };
  } catch {
    return defaultState();
  }
}

/**
 * 예산 파일 쓰기
 */
async function writeBudget(state: BudgetState, budgetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(budgetPath), { recursive: true });
  await fs.writeFile(budgetPath, yaml.dump(state), 'utf-8');
}

/**
 * 날짜/월 변경 여부에 따라 카운터 리셋
 */
function applyResets(state: BudgetState): BudgetState {
  const today = todayStr();
  const thisMonth = thisMonthStr();

  let { daily_count, daily_date, monthly_count, monthly_key, total_estimated_cost_usd } = state;

  if (daily_date !== today) {
    daily_count = 0;
    daily_date = today;
  }
  if (monthly_key !== thisMonth) {
    monthly_count = 0;
    monthly_key = thisMonth;
  }

  return { daily_count, daily_date, monthly_count, monthly_key, total_estimated_cost_usd };
}

/**
 * 예산 한도 확인
 *
 * @param dailyLimit - 일일 호출 한도 (0 = 무제한)
 * @param monthlyLimit - 월별 호출 한도 (0 = 무제한)
 * @param budgetPath - 예산 파일 경로 (테스트 오버라이드용, 기본 getBudgetPath())
 */
export async function checkBudget(
  dailyLimit: number,
  monthlyLimit: number,
  budgetPath: string = getBudgetPath(),
): Promise<BudgetCheckResult> {
  const raw = await readBudget(budgetPath);
  const state = applyResets(raw);

  const remaining_daily = dailyLimit > 0 ? Math.max(0, dailyLimit - state.daily_count) : Infinity;
  const remaining_monthly =
    monthlyLimit > 0 ? Math.max(0, monthlyLimit - state.monthly_count) : Infinity;

  if (dailyLimit > 0 && state.daily_count >= dailyLimit) {
    return {
      allowed: false,
      reason: 'daily_limit_exceeded',
      remaining_daily: 0,
      remaining_monthly: isFinite(remaining_monthly) ? remaining_monthly : monthlyLimit,
    };
  }

  if (monthlyLimit > 0 && state.monthly_count >= monthlyLimit) {
    return {
      allowed: false,
      reason: 'monthly_limit_exceeded',
      remaining_daily: isFinite(remaining_daily) ? remaining_daily : dailyLimit,
      remaining_monthly: 0,
    };
  }

  return {
    allowed: true,
    remaining_daily: isFinite(remaining_daily) ? remaining_daily : dailyLimit,
    remaining_monthly: isFinite(remaining_monthly) ? remaining_monthly : monthlyLimit,
  };
}

/**
 * LLM 호출 1회를 예산에 기록
 *
 * @param inputTokens - 입력 토큰 수
 * @param outputTokens - 출력 토큰 수
 * @param model - 모델 식별자
 * @param budgetPath - 예산 파일 경로 (테스트 오버라이드용, 기본 getBudgetPath())
 */
export async function recordCall(
  inputTokens: number,
  outputTokens: number,
  model: string,
  budgetPath: string = getBudgetPath(),
): Promise<void> {
  const raw = await readBudget(budgetPath);
  const state = applyResets(raw);
  const cost = estimateCost(inputTokens, outputTokens, model);

  const updated: BudgetState = {
    ...state,
    daily_count: state.daily_count + 1,
    monthly_count: state.monthly_count + 1,
    total_estimated_cost_usd: Math.round((state.total_estimated_cost_usd + cost) * 1e10) / 1e10,
  };

  await writeBudget(updated, budgetPath);
}

/**
 * 입출력 토큰과 모델명으로 비용(USD) 추정
 * 알 수 없는 모델은 haiku 단가로 폴백
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-haiku-4-5-20251001'];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
