/**
 * @module providers/openai
 * OpenAI Chat Completions API HTTP 호출 구현
 */

import { LlmProvider, LlmJudgeRequest, LlmJudgeResponse, LlmProviderError } from './types.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

interface OpenAIResponseBody {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export class OpenAIProvider implements LlmProvider {
  readonly name = 'openai';

  constructor(private readonly apiKey: string) {}

  async judge(request: LlmJudgeRequest): Promise<LlmJudgeResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs);

    let response: Response;
    try {
      response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.prompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LlmProviderError(
          `Request timed out after ${request.timeoutMs}ms`,
          this.name,
          undefined,
          true,
        );
      }
      throw new LlmProviderError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`,
        this.name,
        undefined,
        true,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      const isAuth = response.status === 401;
      throw new LlmProviderError(
        isAuth
          ? 'Authentication failed: invalid API key'
          : `API error: HTTP ${response.status}`,
        this.name,
        response.status,
        retryable,
      );
    }

    const body = (await response.json()) as OpenAIResponseBody;
    const rawText = body.choices?.[0]?.message?.content;

    if (typeof rawText !== 'string') {
      throw new LlmProviderError(
        'Unexpected response format: choices[0].message.content is missing',
        this.name,
      );
    }

    let parsed: LlmJudgeResponse;
    try {
      parsed = JSON.parse(rawText) as LlmJudgeResponse;
    } catch {
      throw new LlmProviderError(
        `Failed to parse JSON from response: ${rawText.slice(0, 100)}`,
        this.name,
      );
    }

    return {
      score: parsed.score,
      feedback: parsed.feedback,
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      raw_response: rawText,
      usage: {
        input_tokens: body.usage?.prompt_tokens ?? 0,
        output_tokens: body.usage?.completion_tokens ?? 0,
      },
    };
  }
}
