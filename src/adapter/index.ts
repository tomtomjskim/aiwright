export type { ComposedPrompt, DetectResult, ApplyResult, AdapterContract } from './contract.js';
export { ClaudeCodeAdapter } from './claude-code.js';
export { GenericAdapter } from './generic.js';
export { CursorAdapter } from './cursor.js';
export { CopilotAdapter } from './copilot.js';
export { WindsurfAdapter } from './windsurf.js';
export { detectAdapter, getAdapter, ADAPTERS } from './detect.js';
