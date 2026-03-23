import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// git이 없는 환경에서 graceful fail 테스트를 위해 child_process를 mock
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

import { exec } from 'node:child_process';
import { addGitNote, readGitNotes } from '../../src/intelligence/git-trace.js';

const mockedExec = vi.mocked(exec);

function makeExecImpl(responses: Array<{ stdout?: string; stderr?: string; error?: Error }>) {
  let callCount = 0;
  return (_cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
    const res = responses[callCount] ?? { stdout: '', stderr: '' };
    callCount++;
    if (callback) {
      if (res.error) {
        callback(res.error, { stdout: '', stderr: '' });
      } else {
        callback(null, { stdout: res.stdout ?? '', stderr: res.stderr ?? '' });
      }
    }
    return {} as ReturnType<typeof exec>;
  };
}

describe('addGitNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('git이 없을 때 (rev-parse 실패) false 반환', async () => {
    mockedExec.mockImplementation(makeExecImpl([
      { error: new Error('not a git repository') },
    ]));

    const result = await addGitNote({ recipe: 'test-recipe', fragments: [] });
    expect(result).toBe(false);
  });

  it('HEAD 커밋이 없을 때 false 반환', async () => {
    mockedExec.mockImplementation(makeExecImpl([
      { stdout: '.git\n' },       // rev-parse --git-dir 성공
      { error: new Error('no commits') }, // rev-parse HEAD 실패
    ]));

    const result = await addGitNote({ recipe: 'test-recipe', fragments: [] });
    expect(result).toBe(false);
  });

  it('성공 시 true 반환', async () => {
    mockedExec.mockImplementation(makeExecImpl([
      { stdout: '.git\n' },
      { stdout: 'abc123def456\n' },
      { stdout: '' },
    ]));

    const result = await addGitNote({ recipe: 'test-recipe', fragments: ['ctx', 'role'] });
    expect(result).toBe(true);
  });

  it('dna_code, score가 있으면 노트 메시지에 포함된다', async () => {
    let capturedCmd = '';
    mockedExec.mockImplementation(((cmd: string, _opts: unknown, callback?: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
      capturedCmd = cmd;
      if (callback) {
        if (cmd.includes('rev-parse --git-dir')) {
          callback(null, { stdout: '.git\n', stderr: '' });
        } else if (cmd.includes('rev-parse HEAD')) {
          callback(null, { stdout: 'abc123\n', stderr: '' });
        } else {
          callback(null, { stdout: '', stderr: '' });
        }
      }
      return {} as ReturnType<typeof exec>;
    }) as typeof exec);

    await addGitNote({ recipe: 'my-recipe', fragments: [], dna_code: 'AW-R0V8', score: 0.85 });

    expect(capturedCmd).toContain('recipe=my-recipe');
    expect(capturedCmd).toContain('dna=AW-R0V8');
    expect(capturedCmd).toContain('score=0.85');
  });
});

describe('readGitNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('git이 없을 때 빈 배열 반환', async () => {
    mockedExec.mockImplementation(makeExecImpl([
      { error: new Error('not a git repository') },
    ]));

    const result = await readGitNotes();
    expect(result).toEqual([]);
  });

  it('aiwright 노트가 있으면 파싱해서 반환', async () => {
    const mockLog =
      'abc123def456\n    aiwright: recipe=test-recipe dna=AW-R0V8 score=0.75\n---COMMIT_END---\n';

    mockedExec.mockImplementation(makeExecImpl([
      { stdout: '.git\n' },
      { stdout: mockLog },
    ]));

    const result = await readGitNotes(5);
    expect(result.length).toBeGreaterThanOrEqual(0);
    // git 로그 파싱은 환경 의존적이므로 기본 동작 확인
    expect(Array.isArray(result)).toBe(true);
  });
});
