export interface ComposedPrompt {
  sections: Record<string, string>;
  fullText: string;
  fragments: string[];
  resolvedVars: Record<string, unknown>;
}

export interface DetectResult {
  detected: boolean;
  confidence: number; // 0~1
  reason: string;
}

export interface ApplyResult {
  success: boolean;
  outputPaths: string[];
  message: string;
  postActions?: string[];
}

export interface AdapterContract {
  readonly name: string;
  readonly description: string;

  /** 현재 프로젝트가 이 어댑터 대상인지 자동 감지 */
  detect(projectDir: string): Promise<DetectResult>;

  /** 합성된 프롬프트를 도구에 적용 */
  apply(prompt: ComposedPrompt, projectDir: string): Promise<ApplyResult>;

  /** 현재 적용된 프롬프트 읽기 (diff/롤백용) */
  read(projectDir: string): Promise<ComposedPrompt | null>;

  /** 적용된 프롬프트 제거 (롤백) */
  remove(projectDir: string): Promise<ApplyResult>;
}
