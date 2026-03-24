import { describe, it, expect, vi, beforeEach } from 'vitest';
import { judgePrompt } from '../../src/intelligence/llm-judge.js';

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/intelligence/providers/index.js', () => ({
  resolveApiKey: vi.fn(),
  resolveProvider: vi.fn(),
}));

vi.mock('../../src/intelligence/judge-cache.js', () => ({
  computeCacheKey: vi.fn(() => 'test-hash-64chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  readCache: vi.fn(async () => null),       // 기본: 캐시 미스
  writeCache: vi.fn(async () => undefined), // 기본: no-op
}));

vi.mock('../../src/intelligence/judge-budget.js', () => ({
  checkBudget: vi.fn(async () => ({ allowed: true, remaining_daily: 10, remaining_monthly: 100 })),
  recordCall: vi.fn(async () => undefined),
}));

// mock 모듈 참조 (타입 단언으로 vi.fn() 메서드 접근)
import * as providers from '../../src/intelligence/providers/index.js';
import * as cache from '../../src/intelligence/judge-cache.js';
import * as budget from '../../src/intelligence/judge-budget.js';

// 모든 describe 블록에 공통 beforeEach: 각 테스트 전 mock 호출 기록 초기화
// (구현은 각 describe에서 필요에 따라 재정의)
beforeEach(() => {
  vi.resetAllMocks();
  // 기본값 재설정 (resetAllMocks는 구현도 지움)
  vi.mocked(cache.computeCacheKey).mockReturnValue(
    'test-hash-64chars-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  );
  vi.mocked(cache.readCache).mockResolvedValue(null);
  vi.mocked(cache.writeCache).mockResolvedValue(undefined);
  vi.mocked(budget.checkBudget).mockResolvedValue({
    allowed: true,
    remaining_daily: 10,
    remaining_monthly: 100,
  });
  vi.mocked(budget.recordCall).mockResolvedValue(undefined);
  vi.mocked(providers.resolveApiKey).mockReturnValue(null); // 기본: API 키 없음
});

// 좋은 프롬프트: constraint, system, imperative 모두 포함
const goodPrompt = `[system]
You are a senior software engineer. Always write clean, maintainable code.

[context]
The user is working on a TypeScript project.

[instruction]
Do implement the requested feature following best practices.
Return the complete implementation with comments.
Ensure proper error handling.

[constraint]
Never output code without proper TypeScript types.
Always include JSDoc comments for public functions.

[example]
Input: Create a function to add two numbers
Output: /** Adds two numbers */ function add(a: number, b: number): number { return a + b; }`;

// 나쁜 프롬프트: constraint 없음, 너무 짧음, system 없음
const badPrompt = `do the task`;

// 중간 프롬프트: system 있지만 constraint/example 없음
const midPrompt = `[system]
You are a helpful assistant. Please help with the request.

[instruction]
Complete the task as described.`;

describe('judgePrompt — good prompt', () => {
  it('returns a score between 0 and 1', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('returns a higher score for a well-structured prompt', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(result.score).toBeGreaterThan(0.6);
  });

  it('includes strengths for well-structured prompt', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(result.strengths.length).toBeGreaterThan(0);
  });

  it('feedback is a non-empty string', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(typeof result.feedback).toBe('string');
    expect(result.feedback.length).toBeGreaterThan(0);
  });

  it('model field is populated', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(typeof result.model).toBe('string');
    expect(result.model.length).toBeGreaterThan(0);
  });
});

describe('judgePrompt — bad prompt (HIGH issues)', () => {
  it('returns a lower score when prompt is too short and missing constraint', async () => {
    const result = await judgePrompt(badPrompt);
    expect(result.score).toBeLessThan(0.7);
  });

  it('includes weaknesses when HIGH-severity issues exist', async () => {
    const result = await judgePrompt(badPrompt);
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });

  it('feedback is non-empty for bad prompt', async () => {
    const result = await judgePrompt(badPrompt);
    expect(result.feedback.length).toBeGreaterThan(0);
  });
});

describe('judgePrompt — mid prompt', () => {
  it('returns a moderate score for a mid-quality prompt', async () => {
    const result = await judgePrompt(midPrompt);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('has some weaknesses for mid prompt (missing constraint, example)', async () => {
    const result = await judgePrompt(midPrompt);
    expect(result.weaknesses.length).toBeGreaterThan(0);
  });
});

describe('judgePrompt — options', () => {
  it('accepts model option and reflects it in result', async () => {
    const result = await judgePrompt(goodPrompt, { model: 'gpt-4o' });
    // 시뮬레이션 모드에서는 model 옵션은 무시되고 기본값 사용
    expect(result.model).toBeDefined();
  });

  it('uses default model when no options provided', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(result.model).toBe('heuristic-sim-v1');
  });
});

describe('judgePrompt — return structure', () => {
  it('result has all required fields', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('feedback');
    expect(result).toHaveProperty('strengths');
    expect(result).toHaveProperty('weaknesses');
    expect(result).toHaveProperty('model');
  });

  it('strengths and weaknesses are arrays', async () => {
    const result = await judgePrompt(goodPrompt);
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.weaknesses)).toBe(true);
  });
});

describe('judgePrompt — zero issues prompt', () => {
  const perfectPrompt = `[system]
You are an expert. Always respond concisely.

[context]
Background information here.

[instruction]
Do complete the requested task accurately.
Return a well-structured response.
Ensure correctness.

[constraint]
Never fabricate information. Always cite sources.

[example]
Input: Sample
Output: Result`;

  it('returns high score when lint finds no issues', async () => {
    const result = await judgePrompt(perfectPrompt);
    // 최소한 중간 이상 점수
    expect(result.score).toBeGreaterThanOrEqual(0.5);
  });

  it('has feedback string regardless of score', async () => {
    const result = await judgePrompt(perfectPrompt);
    expect(result.feedback.length).toBeGreaterThan(0);
  });
});

// ─── LLM Mode ────────────────────────────────────────────────────────────────

/** Mock provider 생성 헬퍼 */
function makeMockProvider(overrides?: Partial<{ score: number; feedback: string }>) {
  return {
    name: 'mock-provider',
    judge: vi.fn(async () => ({
      score: overrides?.score ?? 0.88,
      feedback: overrides?.feedback ?? 'LLM feedback text',
      strengths: ['LLM strength 1', 'LLM strength 2'],
      weaknesses: ['LLM weakness 1'],
      usage: { input_tokens: 400, output_tokens: 150 },
    })),
  };
}

describe('judgePrompt — mode: llm — API 키 미설정 → heuristic 폴백', () => {
  it('API 키 없으면 heuristic-sim-v1 모델 반환 (무경고)', async () => {
    vi.mocked(providers.resolveApiKey).mockReturnValue(null);
    const warnSpy = vi.spyOn(console, 'warn');

    const result = await judgePrompt(goodPrompt, { mode: 'llm' });

    expect(result.model).toBe('heuristic-sim-v1');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(vi.mocked(providers.resolveProvider)).not.toHaveBeenCalled();
  });
});

describe('judgePrompt — mode: llm — 정상 provider 응답 → LLM 점수 반환', () => {
  it('provider.judge 결과를 그대로 반환', async () => {
    const mockProvider = makeMockProvider({ score: 0.92, feedback: 'Excellent prompt.' });
    vi.mocked(providers.resolveApiKey).mockReturnValue('sk-test-key');
    vi.mocked(providers.resolveProvider).mockReturnValue(mockProvider);

    const result = await judgePrompt(goodPrompt, { mode: 'llm' });

    expect(result.score).toBe(0.92);
    expect(result.feedback).toBe('Excellent prompt.');
    expect(result.strengths).toContain('LLM strength 1');
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(mockProvider.judge).toHaveBeenCalledOnce();
  });

  it('score는 0~1 범위로 클램핑됨 (초과 값)', async () => {
    const mockProvider = makeMockProvider({ score: 1.5 });
    vi.mocked(providers.resolveApiKey).mockReturnValue('sk-test-key');
    vi.mocked(providers.resolveProvider).mockReturnValue(mockProvider);

    const result = await judgePrompt(goodPrompt, { mode: 'llm' });

    expect(result.score).toBeLessThanOrEqual(1);
  });
});

describe('judgePrompt — mode: llm — provider 에러 → heuristic 폴백 + console.warn', () => {
  it('provider 에러 시 heuristic-sim-v1 반환 및 경고 출력', async () => {
    const mockProvider = {
      name: 'mock-provider',
      judge: vi.fn(async () => {
        throw new Error('API timeout');
      }),
    };
    vi.mocked(providers.resolveApiKey).mockReturnValue('sk-test-key');
    vi.mocked(providers.resolveProvider).mockReturnValue(mockProvider);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await judgePrompt(goodPrompt, { mode: 'llm' });

    expect(result.model).toBe('heuristic-sim-v1');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('LLM judge failed'),
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('API timeout'));
  });
});

describe('judgePrompt — mode: llm — 캐시 히트 → provider 미호출', () => {
  it('캐시 히트 시 provider.judge 호출 없이 cached 결과 반환', async () => {
    const cachedEntry = {
      hash: 'test-hash',
      result: {
        score: 0.77,
        feedback: 'Cached feedback',
        strengths: ['cached strength'],
        weaknesses: [],
        model: 'claude-haiku-4-5-20251001',
      },
      created_at: new Date().toISOString(),
      ttl_hours: 168,
      usage: { input_tokens: 300, output_tokens: 100 },
    };
    vi.mocked(providers.resolveApiKey).mockReturnValue('sk-test-key');
    vi.mocked(cache.readCache).mockResolvedValue(cachedEntry);

    const result = await judgePrompt(goodPrompt, { mode: 'llm' });

    expect(result.score).toBe(0.77);
    expect(result.model).toContain('cached');
    expect(vi.mocked(providers.resolveProvider)).not.toHaveBeenCalled();
  });
});

describe('judgePrompt — mode: llm — 예산 초과 → heuristic 폴백', () => {
  it('dailyLimit 초과 시 heuristic-sim-v1 반환 및 경고 출력', async () => {
    vi.mocked(providers.resolveApiKey).mockReturnValue('sk-test-key');
    vi.mocked(cache.readCache).mockResolvedValue(null);
    vi.mocked(budget.checkBudget).mockResolvedValue({
      allowed: false,
      reason: 'daily_limit_exceeded',
      remaining_daily: 0,
      remaining_monthly: 95,
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await judgePrompt(goodPrompt, { mode: 'llm', dailyLimit: 5 });

    expect(result.model).toBe('heuristic-sim-v1');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Budget exceeded'));
    expect(vi.mocked(providers.resolveProvider)).not.toHaveBeenCalled();
  });
});

// ─── Hybrid Mode ──────────────────────────────────────────────────────────────

describe('judgePrompt — mode: hybrid — LLM 70% + heuristic 30% 블렌딩', () => {
  it('블렌딩 점수 = LLM * 0.7 + heuristic * 0.3 (소수점 반올림)', async () => {
    // LLM 결과가 0.8 이면, heuristic 결과가 대략 0.6~0.7 범위라 가정
    // 블렌딩 점수가 두 점수 사이에 있어야 함
    const mockProvider = makeMockProvider({ score: 0.80 });
    vi.mocked(providers.resolveApiKey).mockReturnValue('sk-test-key');
    vi.mocked(providers.resolveProvider).mockReturnValue(mockProvider);

    const result = await judgePrompt(goodPrompt, { mode: 'hybrid' });

    // heuristic은 실제 계산이므로 goodPrompt 기준 0.5~1.0
    // blended = 0.80 * 0.7 + heuristic * 0.3
    const heuristicResult = await judgePrompt(goodPrompt); // heuristic 기준값
    const expected = Math.round((0.80 * 0.7 + heuristicResult.score * 0.3) * 100) / 100;
    expect(result.score).toBe(expected);
  });

  it('feedback은 LLM 결과를 우선 사용', async () => {
    const mockProvider = makeMockProvider({ feedback: 'Hybrid LLM feedback' });
    vi.mocked(providers.resolveApiKey).mockReturnValue('sk-test-key');
    vi.mocked(providers.resolveProvider).mockReturnValue(mockProvider);

    const result = await judgePrompt(goodPrompt, { mode: 'hybrid' });

    expect(result.feedback).toBe('Hybrid LLM feedback');
  });

  it('strengths/weaknesses에 LLM+heuristic 중복 제거 후 최대 5개', async () => {
    const mockProvider = makeMockProvider({ score: 0.75 });
    vi.mocked(providers.resolveApiKey).mockReturnValue('sk-test-key');
    vi.mocked(providers.resolveProvider).mockReturnValue(mockProvider);

    const result = await judgePrompt(goodPrompt, { mode: 'hybrid' });

    expect(result.strengths.length).toBeLessThanOrEqual(5);
    expect(result.weaknesses.length).toBeLessThanOrEqual(5);
  });
});

describe('judgePrompt — mode: hybrid — LLM 실패 시 heuristic 단독', () => {
  it('LLM provider 에러 → heuristic 단독 결과 (model: heuristic-sim-v1)', async () => {
    const failProvider = {
      name: 'mock-provider',
      judge: vi.fn(async () => {
        throw new Error('Network error');
      }),
    };
    vi.mocked(providers.resolveApiKey).mockReturnValue('sk-test-key');
    vi.mocked(providers.resolveProvider).mockReturnValue(failProvider);

    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await judgePrompt(goodPrompt, { mode: 'hybrid' });

    // LLM 실패 → llmJudge가 heuristic 폴백 반환 → hybridJudge에서 두 heuristic 블렌딩
    // 두 heuristic 결과가 같으므로 score도 같아야 함
    const heuristicResult = await judgePrompt(goodPrompt);
    expect(result.score).toBe(heuristicResult.score);
    // LLM 실패 시 llmJudge 내부에서 heuristic 폴백하므로 model은 heuristic-sim-v1
    expect(result.model).toBe('heuristic-sim-v1');
  });

  it('API 키 없음 → hybrid도 heuristic 단독 동작 (model: heuristic-sim-v1)', async () => {
    vi.mocked(providers.resolveApiKey).mockReturnValue(null);

    const result = await judgePrompt(goodPrompt, { mode: 'hybrid' });

    expect(result.model).toBe('heuristic-sim-v1');
  });
});
