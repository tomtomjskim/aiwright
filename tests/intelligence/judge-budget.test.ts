import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';
import {
  checkBudget,
  recordCall,
  estimateCost,
  getBudgetPath,
  MODEL_PRICING,
  type BudgetState,
} from '../../src/intelligence/judge-budget.js';

// 테스트용 임시 예산 파일 경로 (실제 ~/.aiwright/ 오염 방지)
let tmpDir: string;
let budgetPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-budget-test-'));
  budgetPath = path.join(tmpDir, 'judge-budget.yaml');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function thisMonthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

async function writeBudgetState(state: Partial<BudgetState>): Promise<void> {
  await fs.mkdir(path.dirname(budgetPath), { recursive: true });
  await fs.writeFile(budgetPath, yaml.dump(state), 'utf-8');
}

// ─── checkBudget ─────────────────────────────────────────────────────────────

describe('checkBudget — 초기 상태 (파일 없음)', () => {
  it('파일 없으면 allowed: true', async () => {
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.allowed).toBe(true);
  });

  it('remaining_daily = dailyLimit', async () => {
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.remaining_daily).toBe(50);
  });

  it('remaining_monthly = monthlyLimit', async () => {
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.remaining_monthly).toBe(500);
  });

  it('reason 없음', async () => {
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.reason).toBeUndefined();
  });
});

describe('checkBudget — 한도 미달', () => {
  it('daily_count < dailyLimit → allowed: true', async () => {
    await writeBudgetState({
      daily_count: 30,
      daily_date: todayStr(),
      monthly_count: 30,
      monthly_key: thisMonthStr(),
      total_estimated_cost_usd: 0,
    });
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.allowed).toBe(true);
    expect(result.remaining_daily).toBe(20);
    expect(result.remaining_monthly).toBe(470);
  });
});

describe('checkBudget — 일일 한도 초과', () => {
  it('daily_count >= dailyLimit → allowed: false', async () => {
    await writeBudgetState({
      daily_count: 50,
      daily_date: todayStr(),
      monthly_count: 50,
      monthly_key: thisMonthStr(),
      total_estimated_cost_usd: 0,
    });
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.allowed).toBe(false);
  });

  it('reason: daily_limit_exceeded', async () => {
    await writeBudgetState({
      daily_count: 50,
      daily_date: todayStr(),
      monthly_count: 50,
      monthly_key: thisMonthStr(),
      total_estimated_cost_usd: 0,
    });
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.reason).toBe('daily_limit_exceeded');
  });

  it('remaining_daily: 0', async () => {
    await writeBudgetState({
      daily_count: 60,
      daily_date: todayStr(),
      monthly_count: 60,
      monthly_key: thisMonthStr(),
      total_estimated_cost_usd: 0,
    });
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.remaining_daily).toBe(0);
  });
});

describe('checkBudget — 월별 한도 초과', () => {
  it('monthly_count >= monthlyLimit → allowed: false', async () => {
    await writeBudgetState({
      daily_count: 5,
      daily_date: todayStr(),
      monthly_count: 500,
      monthly_key: thisMonthStr(),
      total_estimated_cost_usd: 0,
    });
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.allowed).toBe(false);
  });

  it('reason: monthly_limit_exceeded', async () => {
    await writeBudgetState({
      daily_count: 5,
      daily_date: todayStr(),
      monthly_count: 500,
      monthly_key: thisMonthStr(),
      total_estimated_cost_usd: 0,
    });
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.reason).toBe('monthly_limit_exceeded');
  });

  it('remaining_monthly: 0', async () => {
    await writeBudgetState({
      daily_count: 5,
      daily_date: todayStr(),
      monthly_count: 600,
      monthly_key: thisMonthStr(),
      total_estimated_cost_usd: 0,
    });
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.remaining_monthly).toBe(0);
  });
});

// ─── 날짜/월 변경 시 리셋 ─────────────────────────────────────────────────────

describe('날짜 변경 시 daily_count 리셋', () => {
  it('어제 날짜로 저장된 daily_count는 리셋되어 allowed: true', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    await writeBudgetState({
      daily_count: 50, // 한도 가득 찬 상태
      daily_date: yesterday,
      monthly_count: 50,
      monthly_key: thisMonthStr(),
      total_estimated_cost_usd: 0,
    });
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.allowed).toBe(true);
    expect(result.remaining_daily).toBe(50);
  });
});

describe('월 변경 시 monthly_count 리셋', () => {
  it('지난 달 monthly_key로 저장된 monthly_count는 리셋되어 allowed: true', async () => {
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1))
      .toISOString()
      .slice(0, 7);
    await writeBudgetState({
      daily_count: 5,
      daily_date: todayStr(),
      monthly_count: 500, // 한도 가득 찬 상태
      monthly_key: lastMonth,
      total_estimated_cost_usd: 0,
    });
    const result = await checkBudget(50, 500, budgetPath);
    expect(result.allowed).toBe(true);
    expect(result.remaining_monthly).toBe(500);
  });
});

// ─── recordCall ───────────────────────────────────────────────────────────────

describe('recordCall — 비용 누적', () => {
  it('호출 후 daily_count +1', async () => {
    await recordCall(500, 200, 'claude-haiku-4-5-20251001', budgetPath);
    const raw = yaml.load(await fs.readFile(budgetPath, 'utf-8')) as BudgetState;
    expect(raw.daily_count).toBe(1);
  });

  it('호출 후 monthly_count +1', async () => {
    await recordCall(500, 200, 'claude-haiku-4-5-20251001', budgetPath);
    const raw = yaml.load(await fs.readFile(budgetPath, 'utf-8')) as BudgetState;
    expect(raw.monthly_count).toBe(1);
  });

  it('연속 호출 시 카운트 누적', async () => {
    await recordCall(500, 200, 'claude-haiku-4-5-20251001', budgetPath);
    await recordCall(500, 200, 'claude-haiku-4-5-20251001', budgetPath);
    await recordCall(500, 200, 'claude-haiku-4-5-20251001', budgetPath);
    const raw = yaml.load(await fs.readFile(budgetPath, 'utf-8')) as BudgetState;
    expect(raw.daily_count).toBe(3);
    expect(raw.monthly_count).toBe(3);
  });

  it('total_estimated_cost_usd 누적', async () => {
    // haiku: 800 input * 0.80/1M + 250 output * 4.00/1M = 0.00064 + 0.001 = 0.00164
    // 두 번 호출: 0.00328
    await recordCall(800, 250, 'claude-haiku-4-5-20251001', budgetPath);
    await recordCall(800, 250, 'claude-haiku-4-5-20251001', budgetPath);
    const raw = yaml.load(await fs.readFile(budgetPath, 'utf-8')) as BudgetState;
    expect(raw.total_estimated_cost_usd).toBeCloseTo(0.00328, 6);
  });
});

// ─── estimateCost ─────────────────────────────────────────────────────────────

describe('estimateCost', () => {
  it('haiku 800 input + 250 output → $0.00164', () => {
    // 800 * 0.80/1M + 250 * 4.00/1M = 0.00064 + 0.001 = 0.00164
    const cost = estimateCost(800, 250, 'claude-haiku-4-5-20251001');
    expect(cost).toBeCloseTo(0.00164, 7);
  });

  it('gpt-4o-mini 1000 input + 500 output', () => {
    // 1000 * 0.15/1M + 500 * 0.60/1M = 0.00015 + 0.0003 = 0.00045
    const cost = estimateCost(1000, 500, 'gpt-4o-mini');
    expect(cost).toBeCloseTo(0.00045, 7);
  });

  it('sonnet 0 tokens → $0', () => {
    const cost = estimateCost(0, 0, 'claude-sonnet-4-5-20250514');
    expect(cost).toBe(0);
  });

  it('알 수 없는 모델 → haiku 단가 폴백', () => {
    const costUnknown = estimateCost(800, 250, 'unknown-model-xyz');
    const costHaiku = estimateCost(800, 250, 'claude-haiku-4-5-20251001');
    expect(costUnknown).toBe(costHaiku);
  });

  it('gpt-4o 비용 계산', () => {
    // 1000 * 2.50/1M + 1000 * 10.00/1M = 0.0025 + 0.01 = 0.0125
    const cost = estimateCost(1000, 1000, 'gpt-4o');
    expect(cost).toBeCloseTo(0.0125, 7);
  });
});

// ─── getBudgetPath ────────────────────────────────────────────────────────────

describe('getBudgetPath', () => {
  it('~/.aiwright/judge-budget.yaml 반환', () => {
    const p = getBudgetPath();
    expect(p).toBe(path.join(os.homedir(), '.aiwright', 'judge-budget.yaml'));
  });
});

// ─── MODEL_PRICING 상수 ───────────────────────────────────────────────────────

describe('MODEL_PRICING', () => {
  it('4개 모델 포함', () => {
    expect(MODEL_PRICING['claude-haiku-4-5-20251001']).toBeDefined();
    expect(MODEL_PRICING['claude-sonnet-4-5-20250514']).toBeDefined();
    expect(MODEL_PRICING['gpt-4o-mini']).toBeDefined();
    expect(MODEL_PRICING['gpt-4o']).toBeDefined();
  });

  it('haiku 단가 검증', () => {
    expect(MODEL_PRICING['claude-haiku-4-5-20251001'].input).toBe(0.80);
    expect(MODEL_PRICING['claude-haiku-4-5-20251001'].output).toBe(4.00);
  });
});
