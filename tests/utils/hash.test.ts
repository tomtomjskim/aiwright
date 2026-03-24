import { describe, it, expect } from 'vitest';
import { sha256, computeHash } from '../../src/utils/hash.js';

describe('sha256', () => {
  it('빈 문자열에 대해 일관된 해시 반환', () => {
    const result = sha256('');
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('동일 입력에 대해 동일 해시 반환', () => {
    const input = 'hello world';
    expect(sha256(input)).toBe(sha256(input));
  });

  it('다른 입력에 대해 다른 해시 반환', () => {
    expect(sha256('foo')).not.toBe(sha256('bar'));
  });

  it('64자 hex 문자열 반환', () => {
    const result = sha256('test');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });

  it('알려진 SHA-256 해시값 확인: "abc"', () => {
    const result = sha256('abc');
    expect(result).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('유니코드 문자열 처리', () => {
    const result = sha256('한국어');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});

describe('computeHash', () => {
  it('sha256와 동일한 결과 반환', () => {
    const input = 'test content';
    expect(computeHash(input)).toBe(sha256(input));
  });

  it('빈 문자열 처리', () => {
    const result = computeHash('');
    expect(result).toHaveLength(64);
  });

  it('긴 문자열 처리', () => {
    const long = 'a'.repeat(10000);
    const result = computeHash(long);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]+$/);
  });
});
