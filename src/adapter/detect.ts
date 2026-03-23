import { AdapterContract } from './contract.js';
import { ClaudeCodeAdapter } from './claude-code.js';
import { GenericAdapter } from './generic.js';
import { CursorAdapter } from './cursor.js';
import { CopilotAdapter } from './copilot.js';
import { WindsurfAdapter } from './windsurf.js';
import { AdapterNotFoundError } from '../utils/errors.js';

const ADAPTERS: AdapterContract[] = [
  new ClaudeCodeAdapter(),
  new CursorAdapter(),
  new CopilotAdapter(),
  new WindsurfAdapter(),
  new GenericAdapter(),
];

/**
 * 모든 어댑터의 detect()를 호출하고 confidence가 가장 높은 어댑터를 반환.
 * detected: false인 어댑터는 후보에서 제외.
 * 모든 어댑터가 detected: false면 GenericAdapter를 기본 반환.
 */
export async function detectAdapter(projectDir: string): Promise<AdapterContract> {
  const results = await Promise.all(
    ADAPTERS.map(async (adapter) => {
      const result = await adapter.detect(projectDir);
      return { adapter, result };
    }),
  );

  const candidates = results.filter(({ result }) => result.detected);

  if (candidates.length === 0) {
    return new GenericAdapter();
  }

  candidates.sort((a, b) => b.result.confidence - a.result.confidence);
  return candidates[0].adapter;
}

/**
 * 이름으로 어댑터 인스턴스 반환.
 * 없는 이름이면 AdapterNotFoundError throw.
 */
export function getAdapter(name: string): AdapterContract {
  const adapter = ADAPTERS.find((a) => a.name === name);
  if (!adapter) {
    throw new AdapterNotFoundError(
      `Adapter '${name}' not found. Available adapters: ${ADAPTERS.map((a) => a.name).join(', ')}`,
      `Use one of: ${ADAPTERS.map((a) => a.name).join(', ')}`,
    );
  }
  return adapter;
}

export { ADAPTERS };
