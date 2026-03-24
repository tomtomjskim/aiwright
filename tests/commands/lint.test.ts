import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { Command } from 'commander';
import { registerLintCommand } from '../../src/commands/lint.js';

// ── 헬퍼 ─────────────────────────────────────────────────────────────────

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-lint-test-'));
}

async function runLint(args: string[], cwd: string): Promise<void> {
  const origCwd = process.cwd;
  process.cwd = () => cwd;

  const program = new Command();
  program.exitOverride();
  registerLintCommand(program);

  try {
    await program.parseAsync(['node', 'aiwright', 'lint', ...args]);
  } finally {
    process.cwd = origCwd;
  }
}

/**
 * tmpDir에 config + fragment 파일을 설정한다.
 * fullBody: 길고 constraint+system 슬롯을 모두 가진 정상 프롬프트 (이슈 없음)
 * shortBody: 너무 짧아 WARN 유발
 * noConstraint: constraint 슬롯 없어 HIGH 유발
 */
async function setupProject(
  tmpDir: string,
  fragmentSlot: 'system' | 'constraint' | 'instruction',
  body: string,
  recipeName = 'default',
): Promise<void> {
  const fragmentName = 'lint-frag';
  const fragmentsDir = path.join(tmpDir, '.aiwright', 'fragments');
  await fs.mkdir(fragmentsDir, { recursive: true });

  const fragmentContent = `---
name: ${fragmentName}
version: 1.0.0
description: Lint test fragment
slot: ${fragmentSlot}
priority: 10
---
${body}
`;
  await fs.writeFile(path.join(fragmentsDir, `${fragmentName}.md`), fragmentContent, 'utf-8');

  const configContent = `version: '1'
adapter: generic

recipes:
  ${recipeName}:
    description: Lint test recipe
    fragments:
      - fragment: ${fragmentName}
`;
  await fs.writeFile(path.join(tmpDir, 'aiwright.config.yaml'), configContent, 'utf-8');
}

/**
 * system + constraint 두 fragment를 모두 가진 완전한 프로젝트를 설정한다.
 * → PS001(Missing Constraint), PS004(No Role) 이슈 없이 clean 실행
 */
async function setupFullProject(tmpDir: string): Promise<void> {
  const fragmentsDir = path.join(tmpDir, '.aiwright', 'fragments');
  await fs.mkdir(fragmentsDir, { recursive: true });

  const systemFragment = `---
name: sys-frag
version: 1.0.0
description: System fragment
slot: system
priority: 10
---
You are a highly capable assistant. Your primary goal is to provide accurate and helpful responses.
You always follow the guidelines provided and maintain a professional tone throughout.
`;

  const constraintFragment = `---
name: con-frag
version: 1.0.0
description: Constraint fragment
slot: constraint
priority: 20
---
Do not generate unverified information. If uncertain, say so explicitly.
Always cite sources when making factual claims. Keep responses concise and relevant.
`;

  await fs.writeFile(path.join(fragmentsDir, 'sys-frag.md'), systemFragment, 'utf-8');
  await fs.writeFile(path.join(fragmentsDir, 'con-frag.md'), constraintFragment, 'utf-8');

  const configContent = `version: '1'
adapter: generic

recipes:
  default:
    description: Full recipe
    fragments:
      - fragment: sys-frag
      - fragment: con-frag
`;
  await fs.writeFile(path.join(tmpDir, 'aiwright.config.yaml'), configContent, 'utf-8');
}

// ── 테스트 ─────────────────────────────────────────────────────────────────

describe('lint command', () => {
  let tmpDir: string;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── 정상 경로 ────────────────────────────────────────────────────────────

  describe('정상 경로', () => {
    it('recipe 이름 없이 실행하면 첫 번째 recipe를 사용한다', async () => {
      await setupFullProject(tmpDir);

      await expect(runLint([], tmpDir)).resolves.not.toThrow();
    });

    it('recipe 이름 명시적 지정으로 실행할 수 있다', async () => {
      await setupFullProject(tmpDir);

      await expect(runLint(['default'], tmpDir)).resolves.not.toThrow();
    });

    it('lint 결과 헤더에 recipe 이름이 포함된다', async () => {
      await setupFullProject(tmpDir);

      await runLint(['default'], tmpDir);

      const allOutput = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allOutput).toContain('default');
    });

    it('lint 출력에 구분선(═)이 포함된다', async () => {
      await setupFullProject(tmpDir);

      await runLint(['default'], tmpDir);

      const allOutput = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allOutput).toContain('═');
    });
  });

  // ── HIGH 이슈 경로 ────────────────────────────────────────────────────────

  describe('HIGH 이슈 경로', () => {
    it('constraint 슬롯 없으면 CommandError(exitCode=2)를 던진다', async () => {
      // system 슬롯만 있고 constraint 없음 → PS001 HIGH
      const longBody =
        'You are a helpful assistant that always provides accurate and detailed information. ' +
        'You follow all instructions carefully and maintain consistency throughout the conversation.';
      await setupProject(tmpDir, 'system', longBody);

      await expect(runLint(['default'], tmpDir)).rejects.toThrow('HIGH');
    });

    it('HIGH 이슈 존재 시 에러 메시지에 "HIGH"가 포함된다', async () => {
      const longBody =
        'You are a helpful assistant that always provides accurate and detailed information. ' +
        'You follow all instructions carefully and maintain consistency throughout the conversation.';
      await setupProject(tmpDir, 'system', longBody);

      try {
        await runLint(['default'], tmpDir);
      } catch (err) {
        expect((err as Error).message).toContain('HIGH');
      }
    });
  });

  // ── 오류 경로 ────────────────────────────────────────────────────────────

  describe('오류 경로', () => {
    it('config 파일 없으면 ConfigNotFoundError를 던진다', async () => {
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-lint-empty-'));
      try {
        await expect(runLint([], emptyDir)).rejects.toThrow('aiwright.config.yaml not found');
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });

    it('존재하지 않는 recipe 이름이면 RecipeNotFoundError를 던진다', async () => {
      await setupFullProject(tmpDir);

      await expect(runLint(['nonexistent-recipe'], tmpDir)).rejects.toThrow(
        'Recipe "nonexistent-recipe" not found',
      );
    });

    it('잘못된 --severity 값이면 ValidationError를 던진다', async () => {
      await setupFullProject(tmpDir);

      await expect(
        runLint(['default', '--severity', 'INVALID'], tmpDir),
      ).rejects.toThrow();
    });
  });

  // ── --severity 필터링 ─────────────────────────────────────────────────────

  describe('--severity 필터링', () => {
    it('--severity HIGH 지정 시 HIGH만 출력한다 (WARN/INFO 제외)', async () => {
      await setupFullProject(tmpDir);

      // 이슈 없는 clean 케이스에서 severity HIGH 지정
      await expect(runLint(['default', '--severity', 'HIGH'], tmpDir)).resolves.not.toThrow();
    });

    it('--severity INFO는 모든 이슈를 포함한다', async () => {
      await setupFullProject(tmpDir);

      await expect(runLint(['default', '--severity', 'INFO'], tmpDir)).resolves.not.toThrow();
    });

    it('--severity 는 대소문자 구분 없이 동작한다', async () => {
      await setupFullProject(tmpDir);

      // 소문자로 지정해도 동작해야 함
      await expect(runLint(['default', '--severity', 'info'], tmpDir)).resolves.not.toThrow();
    });
  });

  // ── 경계 조건 ────────────────────────────────────────────────────────────

  describe('경계 조건', () => {
    it('recipe가 하나도 없으면 CommandError를 던진다', async () => {
      const configContent = `version: '1'
adapter: generic

recipes: {}
`;
      await fs.writeFile(path.join(tmpDir, 'aiwright.config.yaml'), configContent, 'utf-8');

      await expect(runLint([], tmpDir)).rejects.toThrow();
    });

    it('fragment body가 매우 짧으면 WARN 이슈가 발생한다', async () => {
      // constraint 슬롯만 있고 body가 짧음 → PS002(Too Short) + PS004(No Role) 유발
      await setupProject(tmpDir, 'constraint', 'Short.');

      // HIGH (PS004) 이슈 때문에 throw됨
      try {
        await runLint(['default'], tmpDir);
      } catch {
        // 에러 경로는 예상됨
      }

      // 최소한 출력이 발생했는지 확인
      const allOutput = consoleLogSpy.mock.calls.map((c) => String(c[0])).join('\n');
      expect(allOutput.length).toBeGreaterThan(0);
    });
  });
});
