import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIProvider } from '../../../src/intelligence/providers/openai.js';
import { LlmProviderError } from '../../../src/intelligence/providers/types.js';

const BASE_REQUEST = {
  prompt: 'Evaluate this prompt for quality.',
  systemPrompt: 'You are a prompt quality evaluator. Return JSON with score, feedback, strengths, weaknesses.',
  model: 'gpt-4o-mini',
  timeoutMs: 5000,
};

const VALID_JUDGE_RESPONSE = {
  score: 0.78,
  feedback: 'Reasonable structure.',
  strengths: ['Clear role definition'],
  weaknesses: ['No constraint section'],
};

function makeOpenAIBody(content: string) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 80, completion_tokens: 40 },
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

describe('OpenAIProvider', () => {
  const provider = new OpenAIProvider('test-api-key');

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('name is "openai"', () => {
    expect(provider.name).toBe('openai');
  });

  describe('정상 응답', () => {
    it('LlmJudgeResponse를 올바르게 반환한다', async () => {
      mockFetch(200, makeOpenAIBody(JSON.stringify(VALID_JUDGE_RESPONSE)));

      const result = await provider.judge(BASE_REQUEST);

      expect(result.score).toBe(0.78);
      expect(result.feedback).toBe('Reasonable structure.');
      expect(result.strengths).toEqual(['Clear role definition']);
      expect(result.weaknesses).toEqual(['No constraint section']);
      expect(result.raw_response).toBe(JSON.stringify(VALID_JUDGE_RESPONSE));
    });

    it('usage 토큰 수를 prompt_tokens/completion_tokens에서 올바르게 추출한다', async () => {
      mockFetch(200, makeOpenAIBody(JSON.stringify(VALID_JUDGE_RESPONSE)));

      const result = await provider.judge(BASE_REQUEST);

      expect(result.usage.input_tokens).toBe(80);
      expect(result.usage.output_tokens).toBe(40);
    });

    it('strengths/weaknesses가 없으면 빈 배열로 처리한다', async () => {
      const minimal = { score: 0.6, feedback: 'Decent' };
      mockFetch(200, makeOpenAIBody(JSON.stringify(minimal)));

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
        provider: 'openai',
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
        provider: 'openai',
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
        provider: 'openai',
        statusCode: 500,
        retryable: true,
      });
    });

    it('5xx 계열 전체(502 포함)가 retryable이다', async () => {
      mockFetch(502, {});

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
        provider: 'openai',
        retryable: true,
      });
    });
  });

  describe('JSON 파싱 실패', () => {
    it('choices[0].message.content가 유효하지 않은 JSON이면 LlmProviderError를 throw한다', async () => {
      mockFetch(200, makeOpenAIBody('INVALID_JSON_CONTENT'));

      await expect(provider.judge(BASE_REQUEST)).rejects.toMatchObject({
        name: 'LlmProviderError',
        provider: 'openai',
      });
    });

    it('choices 배열이 비어 있으면 LlmProviderError를 throw한다', async () => {
      mockFetch(200, { choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } });

      await expect(provider.judge(BASE_REQUEST)).rejects.toMatchObject({
        name: 'LlmProviderError',
        provider: 'openai',
      });
    });
  });
});
