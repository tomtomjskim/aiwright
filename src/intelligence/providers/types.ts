/**
 * @module providers/types
 * LLM Provider 공통 인터페이스 및 에러 타입
 */

export interface LlmProvider {
  readonly name: string;
  judge(request: LlmJudgeRequest): Promise<LlmJudgeResponse>;
}

export interface LlmJudgeRequest {
  prompt: string;       // 평가 대상 프롬프트 전문
  systemPrompt: string; // 평가 시스템 프롬프트
  model: string;
  timeoutMs: number;
}

export interface LlmJudgeResponse {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  raw_response?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class LlmProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}
