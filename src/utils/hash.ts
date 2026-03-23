import { createHash } from 'node:crypto';

/** SHA-256 해시 (hex 문자열) */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/** SHA-256 해시 — TDD contract alias */
export function computeHash(content: string): string {
  return sha256(content);
}
