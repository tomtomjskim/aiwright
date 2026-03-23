import { AdapterContract, ApplyResult, ComposedPrompt, DetectResult } from './contract.js';

export class GenericAdapter implements AdapterContract {
  readonly name = 'generic';
  readonly description = 'Generic adapter (stdout output)';

  async detect(_projectDir: string): Promise<DetectResult> {
    return {
      detected: true,
      confidence: 0.1,
      reason: 'Generic adapter always matches as fallback',
    };
  }

  async apply(prompt: ComposedPrompt, _projectDir: string): Promise<ApplyResult> {
    process.stdout.write(prompt.fullText);
    if (!prompt.fullText.endsWith('\n')) {
      process.stdout.write('\n');
    }

    return {
      success: true,
      outputPaths: [],
      message: 'Prompt written to stdout',
    };
  }

  async read(_projectDir: string): Promise<ComposedPrompt | null> {
    return null;
  }

  async remove(_projectDir: string): Promise<ApplyResult> {
    return {
      success: true,
      outputPaths: [],
      message: 'Generic adapter has no persistent state to remove',
    };
  }
}
