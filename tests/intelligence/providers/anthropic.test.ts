import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicProvider } from '../../../src/intelligence/providers/anthropic.js';
import { LlmProviderError } from '../../../src/intelligence/providers/types.js';

const BASE_REQUEST = {
  prompt: 'Evaluate this prompt for quality.',
  systemPrompt: 'You are a prompt quality evaluator. Return JSON with score, feedback, strengths, weaknesses.',
  model: 'claude-haiku-4-5-20251001',
  timeoutMs: 5000,
};

const VALID_JUDGE_RESPONSE = {
  score: 0.85,
  feedback: 'Good structure overall.',
  strengths: ['Clear instructions', 'Proper constraints'],
  weaknesses: ['Missing examples'],
};

function makeAnthropicBody(text: string) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 100, output_tokens: 50 },
  };
}

function mockFetch(status: number, body: unknown, throwError?: Error) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
    if (throwError) return Promise.reject(throwError);
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  }));
}

describe('AnthropicProvider', () => {
  const provider = new AnthropicProvider('test-api-key');

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('name is "anthropic"', () => {
    expect(provider.name).toBe('anthropic');
  });

  describe('정상 응답', () => {
    it('LlmJudgeResponse를 올바르게 반환한다', async () => {
      mockFetch(200, makeAnthropicBody(JSON.stringify(VALID_JUDGE_RESPONSE)));

      const result = await provider.judge(BASE_REQUEST);

      expect(result.score).toBe(0.85);
      expect(result.feedback).toBe('Good structure overall.');
      expect(result.strengths).toEqual(['Clear instructions', 'Proper constraints']);
      expect(result.weaknesses).toEqual(['Missing examples']);
      expect(result.raw_response).toBe(JSON.stringify(VALID_JUDGE_RESPONSE));
    });

    it('usage 토큰 수를 올바르게 추출한다', async () => {
      mockFetch(200, makeAnthropicBody(JSON.stringify(VALID_JUDGE_RESPONSE)));

      const result = await provider.judge(BASE_REQUEST);

      expect(result.usage.input_tokens).toBe(100);
      expect(result.usage.output_tokens).toBe(50);
    });

    it('strengths/weaknesses가 없으면 빈 배열로 처리한다', async () => {
      const minimal = { score: 0.5, feedback: 'OK' };
      mockFetch(200, makeAnthropicBody(JSON.stringify(minimal)));

      const result = await provider.judge(BASE_REQUEST);

      expect(result.strengths).toEqual([]);
      expect(result.weaknesses).toEqual([]);
    });
  });

  describe('401 — 인증 오류', () => {
    it('LlmProviderError를 throw하고 retryable은 false이다', async () => {
      mockFetch(401, {});

      await expect(provider.judge(BASE_REQUEST)).rejects.toMatchObject({
        name: 'LlmProviderError',
        provider: 'anthropic',
        statusCode: 401,
        retryable: false,
      });
    });

    it('에러 메시지에 "Authentication failed"가 포함된다', async () => {
      mockFetch(401, {});

      await expect(provider.judge(BASE_REQUEST)).rejects.toThrow('Authentication failed');
    });
  });

  describe('429 — Rate limit', () => {
    it('LlmProviderError를 throw하고 retryable은 true이다', async () => {
      mockFetch(429, {});

      await expect(provider.judge(BASE_REQUEST)).rejects.toMatchObject({
        name: 'LlmProviderError',
        provider: 'anthropic',
        statusCode: 429,
        retryable: true,
      });
    });
  });

  describe('500 — 서버 오류', () => {
    it('LlmProviderError를 throw하고 retryable은 true이다', async () => {
      mockFetch(500, {});

      await expect(provider.judge(BASE_REQUEST)).rejects.toMatchObject({
        name: 'LlmProviderError',
        provider: 'anthropic',
        statusCode: 500,
        retryable: true,
      });
    });

    it('5xx 계열 전체(503 포함)가 retryable이다', async () => {
      mockFetch(503, {});

      await expect(provider.judge(BASE_REQUEST)).rejects.toMatchObject({
        retryable: true,
      });
    });
  });

  describe('타임아웃', () => {
    it('AbortError가 발생하면 LlmProviderError(retryable: true)를 throw한다', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch(0, {}, abortError);

      await expect(provider.judge(BASE_REQUEST)).rejects.toMatchObject({
        name: 'LlmProviderError',
        provider: 'anthropic',
        retryable: true,
      });
    });
  });

  describe('JSON 파싱 실패', () => {
    it('content[0].text가 유효하지 않은 JSON이면 LlmProviderError를 throw한다', async () => {
      mockFetch(200, makeAnthropicBody('NOT_VALID_JSON'));

      await expect(provider.judge(BASE_REQUEST)).rejects.toMatchObject({
        name: 'LlmProviderError',
        provider: 'anthropic',
      });
    });

    it('content 배열이 비어 있으면 LlmProviderError를 throw한다', async () => {
      mockFetch(200, { content: [], usage: { input_tokens: 0, output_tokens: 0 } });

      await expect(provider.judge(BASE_REQUEST)).rejects.toMatchObject({
        name: 'LlmProviderError',
        provider: 'anthropic',
      });
    });
  });
});
