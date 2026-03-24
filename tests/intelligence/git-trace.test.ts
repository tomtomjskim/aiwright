import { describe, it, expect, vi, beforeEach } from 'vitest';

// execFile mock — child_process 전체를 교체
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
import { addGitNote, readGitNotes } from '../../src/intelligence/git-trace.js';

const mockedExecFile = vi.mocked(execFile);

type ExecFileCallback = (err: Error | null, result: { stdout: string; stderr: string }) => void;

function mockExecFile(responses: Record<string, { stdout?: string; error?: Error }>): typeof execFile {
  return ((_cmd: string, args: string[], _opts: unknown, callback?: ExecFileCallback) => {
    // args가 함수인 경우 (opts 생략 패턴) 대응
    const cb = typeof _opts === 'function' ? (_opts as ExecFileCallback) : callback;
    const key = Array.isArray(args) ? args.join(' ') : '';

    // 매칭: args에 특정 키워드가 포함되면 해당 응답 반환
    let res: { stdout?: string; error?: Error } | undefined;
    for (const [pattern, value] of Object.entries(responses)) {
      if (key.includes(pattern)) {
        res = value;
        break;
      }
    }

    res = res ?? { stdout: '' };
    if (cb) {
      if (res.error) {
        cb(res.error, { stdout: '', stderr: '' });
      } else {
        cb(null, { stdout: res.stdout ?? '', stderr: '' });
      }
    }
    return {} as ReturnType<typeof execFile>;
  }) as typeof execFile;
}

describe('addGitNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('git이 없을 때 (rev-parse 실패) false 반환', async () => {
    mockedExecFile.mockImplementation(mockExecFile({
      'rev-parse': { error: new Error('not a git repository') },
    }));

    const result = await addGitNote({ recipe: 'test-recipe', fragments: [] });
    expect(result).toBe(false);
  });

  it('HEAD가 유효한 hex40이 아니면 false 반환', async () => {
    mockedExecFile.mockImplementation(mockExecFile({
      'rev-parse': { stdout: 'not-a-hash\n' },
    }));

    const result = await addGitNote({ recipe: 'test-recipe', fragments: [] });
    expect(result).toBe(false);
  });

  it('성공 시 true 반환', async () => {
    const fakeHash = 'a'.repeat(40);
    mockedExecFile.mockImplementation(mockExecFile({
      'rev-parse': { stdout: `${fakeHash}\n` },
      'notes': { stdout: '' },
    }));

    const result = await addGitNote({ recipe: 'test-recipe', fragments: ['ctx', 'role'] });
    expect(result).toBe(true);
  });

  it('dna_code, score가 있으면 execFile 인자에 포함된다', async () => {
    const fakeHash = 'b'.repeat(40);
    let capturedArgs: string[] = [];

    mockedExecFile.mockImplementation(((_cmd: string, args: string[], _opts: unknown, callback?: ExecFileCallback) => {
      const cb = typeof _opts === 'function' ? (_opts as ExecFileCallback) : callback;
      if (Array.isArray(args) && args.includes('notes')) {
        capturedArgs = args;
      }
      if (cb) {
        if (Array.isArray(args) && args.includes('rev-parse')) {
          cb(null, { stdout: `${fakeHash}\n`, stderr: '' });
        } else {
          cb(null, { stdout: '', stderr: '' });
        }
      }
      return {} as ReturnType<typeof execFile>;
    }) as typeof execFile);

    await addGitNote({ recipe: 'my-recipe', fragments: [], dna_code: 'AW-R0V8', score: 0.85 });

    const noteMsg = capturedArgs.find((a) => a.includes('aiwright:'));
    expect(noteMsg).toBeDefined();
    expect(noteMsg).toContain('recipe=my-recipe');
    expect(noteMsg).toContain('dna=AW-R0V8');
    expect(noteMsg).toContain('score=0.85');
    // commit hash가 마지막 인자로 전달되었는지 확인
    expect(capturedArgs[capturedArgs.length - 1]).toBe(fakeHash);
  });
});

describe('readGitNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('git이 없을 때 빈 배열 반환', async () => {
    mockedExecFile.mockImplementation(mockExecFile({
      'rev-parse': { error: new Error('not a git repository') },
    }));

    const result = await readGitNotes();
    expect(result).toEqual([]);
  });

  it('aiwright 노트가 있으면 파싱해서 반환', async () => {
    const fakeHash = 'c'.repeat(40);
    const mockLog =
      `${fakeHash}\n    aiwright: recipe=test-recipe dna=AW-R0V8 score=0.75\n---COMMIT_END---\n`;

    mockedExecFile.mockImplementation(mockExecFile({
      'rev-parse': { stdout: `${fakeHash}\n` },
      'log': { stdout: mockLog },
    }));

    const result = await readGitNotes(5);
    expect(result.length).toBe(1);
    expect(result[0].recipe).toBe('test-recipe');
    expect(result[0].dna_code).toBe('AW-R0V8');
    expect(result[0].score).toBe(0.75);
    expect(result[0].commit).toBe(fakeHash);
  });
});
