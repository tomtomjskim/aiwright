import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { Command } from 'commander';
import { registerAddCommand } from '../../src/commands/add.js';

// builtins 경로를 임시 디렉토리로 리다이렉트하는 모킹은 복잡하므로
// 로컬 파일 경로(isLocalPath) 케이스를 중심으로 테스트합니다.

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-add-test-'));
}

/** tmpDir에 유효한 fragment .md 파일을 생성 */
async function makeFragmentFile(dir: string, name: string): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const content = `---
name: ${name}
version: 1.0.0
description: Test fragment
slot: system
priority: 10
---
You are a helpful test assistant.
`;
  const filePath = path.join(dir, `${name}.md`);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

async function runAdd(args: string[], cwd: string): Promise<void> {
  const origCwd = process.cwd;
  process.cwd = () => cwd;

  const program = new Command();
  program.exitOverride();
  registerAddCommand(program);

  try {
    await program.parseAsync(['node', 'aiwright', 'add', ...args]);
  } finally {
    process.cwd = origCwd;
  }
}

describe('add command', () => {
  let tmpDir: string;
  let srcDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    srcDir = await makeTempDir();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.rm(srcDir, { recursive: true, force: true });
  });

  // ── 정상 경로 ────────────────────────────────────────────────────────────

  describe('정상 경로', () => {
    it('로컬 경로 fragment를 .aiwright/fragments/에 복사한다', async () => {
      const srcFile = await makeFragmentFile(srcDir, 'my-frag');

      await runAdd([srcFile], tmpDir);

      const destPath = path.join(tmpDir, '.aiwright', 'fragments', 'my-frag.md');
      const exists = await fs.access(destPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('추가 성공 시 성공 메시지가 출력된다', async () => {
      const srcFile = await makeFragmentFile(srcDir, 'my-frag');

      await runAdd([srcFile], tmpDir);

      const allOutput = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allOutput).toContain('my-frag');
    });
  });

  // ── --force 옵션 ─────────────────────────────────────────────────────────

  describe('--force 옵션', () => {
    it('--force 없이 이미 존재하는 fragment 추가 시 경고를 출력한다', async () => {
      const srcFile = await makeFragmentFile(srcDir, 'dup-frag');

      // 첫 번째 추가
      await runAdd([srcFile], tmpDir);
      consoleLogSpy.mockClear();

      // 두 번째 추가 (--force 없음) — process.exit(0) 호출되므로 exitOverride로 인해 throw
      try {
        await runAdd([srcFile], tmpDir);
      } catch {
        // exitOverride 예외 무시
      }

      const allOutput = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allOutput).toContain('already exists');
    });

    it('--force 옵션으로 기존 fragment를 덮어쓴다', async () => {
      const srcFile = await makeFragmentFile(srcDir, 'force-frag');

      // 첫 번째 추가
      await runAdd([srcFile], tmpDir);

      // 원본 파일 내용을 바꿔서 덮어쓰기 여부 확인
      const newContent = `---
name: force-frag
version: 2.0.0
description: Updated fragment
slot: instruction
priority: 20
---
Updated content here.
`;
      await fs.writeFile(srcFile, newContent, 'utf-8');

      // --force로 덮어쓰기
      await runAdd([srcFile, '--force'], tmpDir);

      const destPath = path.join(tmpDir, '.aiwright', 'fragments', 'force-frag.md');
      const content = await fs.readFile(destPath, 'utf-8');
      expect(content).toContain('Updated content here.');
    });

    it('--force 덮어쓰기 시 overwriting 메시지가 출력된다', async () => {
      const srcFile = await makeFragmentFile(srcDir, 'force-frag2');

      await runAdd([srcFile], tmpDir);
      consoleLogSpy.mockClear();

      await runAdd([srcFile, '--force'], tmpDir);

      const allOutput = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allOutput).toContain('verwriting');
    });
  });

  // ── 오류 경로 ────────────────────────────────────────────────────────────

  describe('오류 경로', () => {
    it('존재하지 않는 로컬 경로를 지정하면 에러 메시지를 출력한다', async () => {
      const nonExistent = path.join(srcDir, 'no-such-file.md');

      try {
        await runAdd([nonExistent], tmpDir);
      } catch {
        // exitOverride 예외 무시
      }

      const allErrors = consoleErrorSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allErrors).toContain('E001');
    });
  });
});
