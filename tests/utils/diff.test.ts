import { describe, it, expect } from 'vitest';
import { computeDiff, formatDiff } from '../../src/utils/diff.js';
import type { DiffLine } from '../../src/utils/diff.js';

// chalk 색상 코드 제거 헬퍼
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

describe('computeDiff', () => {
  it('빈 입력: 두 텍스트 모두 빈 문자열이면 빈 배열 반환', () => {
    const result = computeDiff('', '');
    expect(result).toEqual([]);
  });

  it('동일 텍스트: 모든 라인이 context 타입으로 반환', () => {
    const text = 'line1\nline2\nline3';
    const result = computeDiff(text, text);
    expect(result.every((l) => l.type === 'context')).toBe(true);
    expect(result.map((l) => l.content)).toEqual(['line1', 'line2', 'line3']);
  });

  it('추가만: old가 빈 문자열이면 모든 라인이 add 타입', () => {
    const result = computeDiff('', 'alpha\nbeta\ngamma');
    expect(result.every((l) => l.type === 'add')).toBe(true);
    expect(result.map((l) => l.content)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('삭제만: new가 빈 문자열이면 모든 라인이 remove 타입', () => {
    const result = computeDiff('alpha\nbeta\ngamma', '');
    expect(result.every((l) => l.type === 'remove')).toBe(true);
    expect(result.map((l) => l.content)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('변경: 중간 라인 교체 시 remove 후 add 생성', () => {
    const oldText = 'line1\nold line\nline3';
    const newText = 'line1\nnew line\nline3';
    const result = computeDiff(oldText, newText);

    const types = result.map((l) => l.type);
    expect(types).toContain('remove');
    expect(types).toContain('add');
    expect(types).toContain('context');

    const removed = result.filter((l) => l.type === 'remove').map((l) => l.content);
    const added = result.filter((l) => l.type === 'add').map((l) => l.content);
    expect(removed).toContain('old line');
    expect(added).toContain('new line');
  });

  it('단일 라인 추가: 끝에 라인 추가', () => {
    const result = computeDiff('line1\nline2', 'line1\nline2\nline3');
    const added = result.filter((l) => l.type === 'add');
    expect(added).toHaveLength(1);
    expect(added[0].content).toBe('line3');
  });

  it('단일 라인 삭제: 첫 라인 삭제', () => {
    const result = computeDiff('line1\nline2\nline3', 'line2\nline3');
    const removed = result.filter((l) => l.type === 'remove');
    expect(removed).toHaveLength(1);
    expect(removed[0].content).toBe('line1');
  });

  it('복수 라인 변경: LCS로 공통 라인 보존', () => {
    const oldText = 'a\nb\nc\nd';
    const newText = 'a\nX\nc\nY';
    const result = computeDiff(oldText, newText);

    const contexts = result.filter((l) => l.type === 'context').map((l) => l.content);
    expect(contexts).toContain('a');
    expect(contexts).toContain('c');

    const removed = result.filter((l) => l.type === 'remove').map((l) => l.content);
    const added = result.filter((l) => l.type === 'add').map((l) => l.content);
    expect(removed).toContain('b');
    expect(removed).toContain('d');
    expect(added).toContain('X');
    expect(added).toContain('Y');
  });

  it('old가 비어있고 new에 단일 라인: add 하나 반환', () => {
    const result = computeDiff('', 'only line');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'add', content: 'only line' });
  });

  it('new가 비어있고 old에 단일 라인: remove 하나 반환', () => {
    const result = computeDiff('only line', '');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'remove', content: 'only line' });
  });
});

describe('formatDiff', () => {
  it('빈 배열 입력 시 "(no changes)" 반환', () => {
    const output = stripAnsi(formatDiff([]));
    expect(output).toBe('(no changes)');
  });

  it('모두 context (동일 텍스트) 시 "(no changes)" 반환', () => {
    const lines: DiffLine[] = [
      { type: 'context', content: 'same line 1' },
      { type: 'context', content: 'same line 2' },
    ];
    const output = stripAnsi(formatDiff(lines));
    expect(output).toBe('(no changes)');
  });

  it('add 라인은 "+ " 접두사로 출력', () => {
    const lines: DiffLine[] = [{ type: 'add', content: 'new line' }];
    const output = stripAnsi(formatDiff(lines));
    expect(output).toContain('+ new line');
  });

  it('remove 라인은 "- " 접두사로 출력', () => {
    const lines: DiffLine[] = [{ type: 'remove', content: 'old line' }];
    const output = stripAnsi(formatDiff(lines));
    expect(output).toContain('- old line');
  });

  it('context 라인은 "  " (두 칸) 접두사로 출력', () => {
    const lines: DiffLine[] = [
      { type: 'context', content: 'context line' },
      { type: 'add', content: 'added' },
    ];
    const output = stripAnsi(formatDiff(lines));
    expect(output).toContain('  context line');
  });

  it('변경 라인 주변 3줄만 컨텍스트로 표시 (그 이상은 @@ ... @@ 구분선)', () => {
    // context 10줄 + add 1줄 구조: 앞쪽 context는 3줄만 보여야 함
    const lines: DiffLine[] = [
      ...Array.from({ length: 7 }, (_, i): DiffLine => ({ type: 'context', content: `ctx-${i}` })),
      { type: 'add', content: 'inserted' },
      ...Array.from({ length: 7 }, (_, i): DiffLine => ({ type: 'context', content: `ctx-after-${i}` })),
    ];
    const output = stripAnsi(formatDiff(lines));

    // 3줄 이전 context(ctx-0 ~ ctx-3)는 생략되어야 함
    expect(output).not.toContain('ctx-0');
    expect(output).not.toContain('ctx-3');

    // 변경 바로 앞 3줄(ctx-4, ctx-5, ctx-6)은 보여야 함
    expect(output).toContain('ctx-4');
    expect(output).toContain('ctx-5');
    expect(output).toContain('ctx-6');

    // 추가된 라인 표시
    expect(output).toContain('+ inserted');

    // 구분선 포함
    expect(output).toContain('@@ ... @@');
  });

  it('computeDiff + formatDiff 통합: 실제 변경 내용 올바르게 출력', () => {
    const oldText = 'hello\nworld\nfoo';
    const newText = 'hello\nuniverse\nfoo';
    const diffLines = computeDiff(oldText, newText);
    const output = stripAnsi(formatDiff(diffLines));

    expect(output).toContain('- world');
    expect(output).toContain('+ universe');
    expect(output).toContain('  hello');
    expect(output).toContain('  foo');
  });
});
