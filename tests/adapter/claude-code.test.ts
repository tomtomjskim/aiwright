import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { ClaudeCodeAdapter } from '../../src/adapter/claude-code.js';
import type { ComposedPrompt } from '../../src/adapter/contract.js';

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-adapter-test-'));
}

function makePrompt(fullText: string): ComposedPrompt {
  return { sections: { full: fullText }, fullText, fragments: ['test-frag'], resolvedVars: {} };
}

describe('ClaudeCodeAdapter (separate .claude/CLAUDE.md)', () => {
  let adapter: ClaudeCodeAdapter;
  let tmpDir: string;

  beforeEach(async () => {
    adapter = new ClaudeCodeAdapter();
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('detect', () => {
    it('detects with high confidence when .claude/ exists', async () => {
      await fs.mkdir(path.join(tmpDir, '.claude'), { recursive: true });
      const result = await adapter.detect(tmpDir);
      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects with lower confidence when only root CLAUDE.md exists', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Project');
      const result = await adapter.detect(tmpDir);
      expect(result.detected).toBe(true);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('returns detected=false when neither exists', async () => {
      const result = await adapter.detect(tmpDir);
      expect(result.detected).toBe(false);
    });
  });

  describe('apply', () => {
    it('creates .claude/CLAUDE.md without touching root CLAUDE.md', async () => {
      // Root CLAUDE.md exists with project content
      const rootPath = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(rootPath, '# My Project Rules\nDo not touch this.');

      const prompt = makePrompt('You are a helpful assistant.');
      const result = await adapter.apply(prompt, tmpDir);

      expect(result.success).toBe(true);

      // Root CLAUDE.md untouched
      const rootContent = await fs.readFile(rootPath, 'utf-8');
      expect(rootContent).toBe('# My Project Rules\nDo not touch this.');

      // .claude/CLAUDE.md created
      const aiwrightPath = path.join(tmpDir, '.claude', 'CLAUDE.md');
      const aiwrightContent = await fs.readFile(aiwrightPath, 'utf-8');
      expect(aiwrightContent).toContain('You are a helpful assistant.');
      expect(aiwrightContent).toContain('managed by aiwright');
    });

    it('creates .claude/ directory if it does not exist', async () => {
      const prompt = makePrompt('Test prompt.');
      await adapter.apply(prompt, tmpDir);

      const exists = await fs.stat(path.join(tmpDir, '.claude')).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('overwrites previous .claude/CLAUDE.md on re-apply', async () => {
      await adapter.apply(makePrompt('First version.'), tmpDir);
      await adapter.apply(makePrompt('Second version.'), tmpDir);

      const content = await fs.readFile(path.join(tmpDir, '.claude', 'CLAUDE.md'), 'utf-8');
      expect(content).toContain('Second version.');
      expect(content).not.toContain('First version.');
    });

    it('returns .claude/CLAUDE.md in outputPaths', async () => {
      const result = await adapter.apply(makePrompt('Test.'), tmpDir);
      expect(result.outputPaths[0]).toBe(path.join(tmpDir, '.claude', 'CLAUDE.md'));
    });

    it('includes header comment in output', async () => {
      await adapter.apply(makePrompt('Content.'), tmpDir);
      const content = await fs.readFile(path.join(tmpDir, '.claude', 'CLAUDE.md'), 'utf-8');
      expect(content).toContain('Do not edit manually');
      expect(content).toContain('aiwright apply');
    });
  });

  describe('read', () => {
    it('returns null when .claude/CLAUDE.md does not exist', async () => {
      const result = await adapter.read(tmpDir);
      expect(result).toBeNull();
    });

    it('reads prompt content from .claude/CLAUDE.md', async () => {
      await adapter.apply(makePrompt('Read this back.'), tmpDir);
      const result = await adapter.read(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.fullText).toContain('Read this back.');
    });

    it('strips header from read result', async () => {
      await adapter.apply(makePrompt('Actual content.'), tmpDir);
      const result = await adapter.read(tmpDir);
      expect(result!.fullText).not.toContain('managed by aiwright');
      expect(result!.fullText).toContain('Actual content.');
    });
  });

  describe('remove', () => {
    it('returns success when .claude/CLAUDE.md does not exist', async () => {
      const result = await adapter.remove(tmpDir);
      expect(result.success).toBe(true);
    });

    it('deletes .claude/CLAUDE.md', async () => {
      await adapter.apply(makePrompt('To be removed.'), tmpDir);
      const result = await adapter.remove(tmpDir);
      expect(result.success).toBe(true);

      const exists = await fs.stat(path.join(tmpDir, '.claude', 'CLAUDE.md')).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('does not touch root CLAUDE.md', async () => {
      const rootPath = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(rootPath, '# Keep me');
      await adapter.apply(makePrompt('Managed.'), tmpDir);
      await adapter.remove(tmpDir);

      const rootContent = await fs.readFile(rootPath, 'utf-8');
      expect(rootContent).toBe('# Keep me');
    });
  });
});
