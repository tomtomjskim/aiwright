/**
 * @module providers/anthropic
 * Anthropic Claude API HTTP 호출 구현
 */

import { LlmProvider, LlmJudgeRequest, LlmJudgeResponse, LlmProviderError } from './types.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicResponseBody {
  content: Array<{ type: string; text: string }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';

  constructor(private readonly apiKey: string) {}

  async judge(request: LlmJudgeRequest): Promise<LlmJudgeResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), request.timeoutMs);

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: 1024,
          system: request.systemPrompt,
          messages: [{ role: 'user', content: request.prompt }],
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

    const body = (await response.json()) as AnthropicResponseBody;
    const rawText = body.content?.[0]?.text;

    if (typeof rawText !== 'string') {
      throw new LlmProviderError(
        'Unexpected response format: content[0].text is missing',
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
        input_tokens: body.usage?.input_tokens ?? 0,
        output_tokens: body.usage?.output_tokens ?? 0,
      },
    };
  }
}
