import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  resolveProvider,
  resolveApiKey,
} from '../../../src/intelligence/providers/index.js';
import { AnthropicProvider } from '../../../src/intelligence/providers/anthropic.js';
import { OpenAIProvider } from '../../../src/intelligence/providers/openai.js';

describe('resolveProvider', () => {
  it('"anthropic" → AnthropicProvider 인스턴스를 반환한다', () => {
    const provider = resolveProvider('anthropic', 'key-abc');
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.name).toBe('anthropic');
  });

  it('"openai" → OpenAIProvider 인스턴스를 반환한다', () => {
    const provider = resolveProvider('openai', 'key-xyz');
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe('openai');
  });

  it('알 수 없는 provider → Error를 throw한다', () => {
    expect(() => resolveProvider('unknown', 'any-key')).toThrow('Unknown provider: unknown');
  });

  it('빈 문자열 provider → Error를 throw한다', () => {
    expect(() => resolveProvider('', 'any-key')).toThrow('Unknown provider:');
  });
});

describe('resolveApiKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('환경변수가 설정되어 있으면 해당 값을 반환한다', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'env-test-key-123');
    const key = resolveApiKey('ANTHROPIC_API_KEY');
    expect(key).toBe('env-test-key-123');
  });

  it('환경변수가 없으면 null을 반환한다', () => {
    const key = resolveApiKey('MISSING_KEY_THAT_DOES_NOT_EXIST_XYZ');
    expect(key).toBeNull();
  });

  it('directKey가 주어지면 환경변수보다 우선 반환한다', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'env-value');
    const key = resolveApiKey('ANTHROPIC_API_KEY', 'direct-key-override');
    expect(key).toBe('direct-key-override');
  });

  it('directKey가 빈 문자열이면 환경변수를 사용한다', () => {
    vi.stubEnv('SOME_API_KEY', 'env-fallback');
    // 빈 문자열은 falsy이므로 환경변수 반환
    const key = resolveApiKey('SOME_API_KEY', '');
    expect(key).toBe('env-fallback');
  });

  it('directKey도 없고 환경변수도 없으면 null을 반환한다', () => {
    const key = resolveApiKey('TOTALLY_MISSING_KEY_999');
    expect(key).toBeNull();
  });
});
