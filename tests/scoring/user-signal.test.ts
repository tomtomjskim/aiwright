import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recordScore, type RecordScoreOptions } from '../../src/scoring/user-signal.js';

vi.mock('../../src/scoring/history.js', () => ({
  appendHistory: vi.fn(() => Promise.resolve(undefined)),
}));

describe('recordScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 정상 경로 ────────────────────────────────────────────────────────────

  describe('정상 경로', () => {
    it('options 객체를 받아 ScoreResult를 반환한다', async () => {
      const opts: RecordScoreOptions = { name: 'my-fragment', value: 0.8 };
      const result = await recordScore(opts);

      expect(result.fragment_or_recipe).toBe('my-fragment');
      expect(result.overall).toBe(0.8);
      expect(result.metrics).toHaveLength(1);
      expect(result.metrics[0].name).toBe('user_rating');
      expect(result.metrics[0].value).toBe(0.8);
      expect(result.metrics[0].source).toBe('user');
    });

    it('note를 전달하면 metric의 rationale에 포함된다', async () => {
      const result = await recordScore({ name: 'frag', value: 0.5, note: 'looks good' });
      expect(result.metrics[0].rationale).toBe('looks good');
    });

    it('adapter를 전달하면 결과에 포함된다', async () => {
      const result = await recordScore({ name: 'frag', value: 0.7, adapter: 'claude-code' });
      expect(result.adapter).toBe('claude-code');
    });

    it('value=0 경계값을 허용한다', async () => {
      const result = await recordScore({ name: 'frag', value: 0 });
      expect(result.overall).toBe(0);
    });

    it('value=1 경계값을 허용한다', async () => {
      const result = await recordScore({ name: 'frag', value: 1 });
      expect(result.overall).toBe(1);
    });

    it('timestamp이 ISO 8601 형식으로 기록된다', async () => {
      const result = await recordScore({ name: 'frag', value: 0.5 });
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
    });
  });

  // ── 오류 경로 ────────────────────────────────────────────────────────────

  describe('오류 경로', () => {
    it('value가 0 미만이면 RangeError를 던진다', async () => {
      await expect(recordScore({ name: 'frag', value: -0.1 })).rejects.toThrow(RangeError);
    });

    it('value가 1 초과이면 RangeError를 던진다', async () => {
      await expect(recordScore({ name: 'frag', value: 1.1 })).rejects.toThrow(RangeError);
    });

    it('RangeError 메시지에 잘못된 값이 포함된다', async () => {
      await expect(recordScore({ name: 'frag', value: 2 })).rejects.toThrow('2');
    });
  });

  // ── 경계 조건 ────────────────────────────────────────────────────────────

  describe('경계 조건', () => {
    it('note와 adapter 모두 생략해도 정상 동작한다', async () => {
      const result = await recordScore({ name: 'frag', value: 0.5 });
      expect(result.metrics[0].rationale).toBeUndefined();
      expect(result.adapter).toBeUndefined();
    });
  });
});
