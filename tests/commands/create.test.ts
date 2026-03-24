import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { Command } from 'commander';
import { registerCreateCommand } from '../../src/commands/create.js';

// ── 헬퍼 ─────────────────────────────────────────────────────────────────

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-create-test-'));
}

async function runCreate(args: string[], cwd: string): Promise<void> {
  const origCwd = process.cwd;
  process.cwd = () => cwd;

  const program = new Command();
  program.exitOverride();
  registerCreateCommand(program);

  try {
    await program.parseAsync(['node', 'aiwright', 'create', ...args]);
  } finally {
    process.cwd = origCwd;
  }
}

// ── 테스트 ─────────────────────────────────────────────────────────────────

describe('create command', () => {
  let tmpDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── 정상 경로 ────────────────────────────────────────────────────────────

  describe('정상 경로', () => {
    it('fragment 파일이 .aiwright/fragments/ 아래에 생성된다', async () => {
      await runCreate(
        ['--name', 'my-frag', '--slot', 'system', '--body', 'Hello world.'],
        tmpDir,
      );

      const targetPath = path.join(tmpDir, '.aiwright', 'fragments', 'my-frag.md');
      const exists = await fs.access(targetPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('생성된 파일에 YAML frontmatter가 포함된다', async () => {
      await runCreate(
        ['--name', 'my-frag', '--slot', 'instruction', '--body', 'Follow the pattern.'],
        tmpDir,
      );

      const targetPath = path.join(tmpDir, '.aiwright', 'fragments', 'my-frag.md');
      const content = await fs.readFile(targetPath, 'utf-8');

      expect(content).toContain('---');
      expect(content).toContain('name: my-frag');
      expect(content).toContain('slot: instruction');
    });

    it('생성된 파일에 body 내용이 포함된다', async () => {
      const bodyText = 'Always respond in a formal manner.';
      await runCreate(
        ['--name', 'formal-frag', '--slot', 'constraint', '--body', bodyText],
        tmpDir,
      );

      const targetPath = path.join(tmpDir, '.aiwright', 'fragments', 'formal-frag.md');
      const content = await fs.readFile(targetPath, 'utf-8');
      expect(content).toContain(bodyText);
    });

    it('--tags 옵션으로 태그를 지정하면 frontmatter에 포함된다', async () => {
      await runCreate(
        ['--name', 'tagged-frag', '--slot', 'system', '--body', 'Content.', '--tags', 'a,b,c'],
        tmpDir,
      );

      const targetPath = path.join(tmpDir, '.aiwright', 'fragments', 'tagged-frag.md');
      const content = await fs.readFile(targetPath, 'utf-8');
      expect(content).toContain('tags');
    });

    it('--body-file 옵션으로 파일에서 body를 읽어온다', async () => {
      const bodyFile = path.join(tmpDir, 'body.txt');
      await fs.writeFile(bodyFile, 'Body from file.', 'utf-8');

      await runCreate(
        ['--name', 'file-frag', '--slot', 'context', '--body-file', bodyFile],
        tmpDir,
      );

      const targetPath = path.join(tmpDir, '.aiwright', 'fragments', 'file-frag.md');
      const content = await fs.readFile(targetPath, 'utf-8');
      expect(content).toContain('Body from file.');
    });

    it('성공 시 생성 성공 메시지가 출력된다', async () => {
      await runCreate(
        ['--name', 'success-frag', '--slot', 'output', '--body', 'Output format.'],
        tmpDir,
      );

      const allOutput = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allOutput).toContain('success-frag');
    });

    it('모든 유효한 slot 값을 허용한다', async () => {
      const validSlots = ['system', 'context', 'instruction', 'constraint', 'output', 'example', 'custom'];

      for (const slot of validSlots) {
        const fragDir = await makeTempDir();
        try {
          await runCreate(
            ['--name', `frag-${slot}`, '--slot', slot, '--body', 'Content.'],
            fragDir,
          );

          const targetPath = path.join(fragDir, '.aiwright', 'fragments', `frag-${slot}.md`);
          const exists = await fs.access(targetPath).then(() => true).catch(() => false);
          expect(exists, `slot "${slot}" should create file`).toBe(true);
        } finally {
          await fs.rm(fragDir, { recursive: true, force: true });
        }
      }
    });
  });

  // ── 오류 경로 ────────────────────────────────────────────────────────────

  describe('오류 경로', () => {
    it('잘못된 이름(대문자 포함)이면 ValidationError를 던진다', async () => {
      await expect(
        runCreate(['--name', 'MyFrag', '--slot', 'system', '--body', 'Content.'], tmpDir),
      ).rejects.toThrow();
    });

    it('잘못된 이름(공백 포함)이면 ValidationError를 던진다', async () => {
      await expect(
        runCreate(['--name', 'my frag', '--slot', 'system', '--body', 'Content.'], tmpDir),
      ).rejects.toThrow();
    });

    it('이름이 숫자로 시작해도 /^[a-z0-9]/ 패턴에 매치되면 유효하다', async () => {
      await expect(
        runCreate(['--name', '1-frag', '--slot', 'system', '--body', 'Content.'], tmpDir),
      ).resolves.not.toThrow();
    });

    it('잘못된 slot 값이면 ValidationError를 던진다', async () => {
      await expect(
        runCreate(['--name', 'my-frag', '--slot', 'invalid-slot', '--body', 'Content.'], tmpDir),
      ).rejects.toThrow('Invalid slot');
    });

    it('이미 같은 이름의 fragment가 존재하면 CommandError를 던진다', async () => {
      await runCreate(
        ['--name', 'dup-frag', '--slot', 'system', '--body', 'First.'],
        tmpDir,
      );

      await expect(
        runCreate(['--name', 'dup-frag', '--slot', 'system', '--body', 'Second.'], tmpDir),
      ).rejects.toThrow('already exists');
    });

    it('--body와 --body-file 둘 다 없으면 ValidationError를 던진다', async () => {
      await expect(
        runCreate(['--name', 'nobody-frag', '--slot', 'system'], tmpDir),
      ).rejects.toThrow();
    });

    it('존재하지 않는 --body-file 경로이면 FileIOError를 던진다', async () => {
      await expect(
        runCreate(
          ['--name', 'bodyfail-frag', '--slot', 'system', '--body-file', '/nonexistent/path/body.txt'],
          tmpDir,
        ),
      ).rejects.toThrow();
    });
  });

  // ── 경계 조건 ────────────────────────────────────────────────────────────

  describe('경계 조건', () => {
    it('priority 0은 유효하다', async () => {
      await expect(
        runCreate(['--name', 'low-pri', '--slot', 'system', '--body', 'Low priority.', '--priority', '0'], tmpDir),
      ).resolves.not.toThrow();
    });

    it('priority 999는 유효하다', async () => {
      const dir2 = await makeTempDir();
      try {
        await expect(
          runCreate(['--name', 'high-pri', '--slot', 'system', '--body', 'High priority.', '--priority', '999'], dir2),
        ).resolves.not.toThrow();
      } finally {
        await fs.rm(dir2, { recursive: true, force: true });
      }
    });

    it('priority 1000은 ValidationError를 던진다', async () => {
      await expect(
        runCreate(
          ['--name', 'toohigh', '--slot', 'system', '--body', 'Too high.', '--priority', '1000'],
          tmpDir,
        ),
      ).rejects.toThrow();
    });

    it('하이픈으로 시작하는 이름은 ValidationError를 던진다', async () => {
      await expect(
        runCreate(['--name', '-bad-name', '--slot', 'system', '--body', 'Content.'], tmpDir),
      ).rejects.toThrow();
    });
  });
});
