/**
 * @module providers/index
 * LLM Provider 팩토리 및 API 키 해결 유틸리티
 */

import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import type { LlmProvider } from './types.js';

export function resolveProvider(provider: string, apiKey: string): LlmProvider {
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'openai':
      return new OpenAIProvider(apiKey);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export function resolveApiKey(apiKeyEnv: string, directKey?: string): string | null {
  if (directKey) return directKey;
  return process.env[apiKeyEnv] ?? null;
}

export * from './types.js';
