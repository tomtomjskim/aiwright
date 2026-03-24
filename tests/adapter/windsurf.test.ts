import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { WindsurfAdapter } from '../../src/adapter/windsurf.js';
import type { ComposedPrompt } from '../../src/adapter/contract.js';

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-windsurf-test-'));
}

function makePrompt(fullText: string): ComposedPrompt {
  return { sections: { full: fullText }, fullText, fragments: ['test-frag'], resolvedVars: {} };
}

const TARGET = '.windsurfrules';
const BACKUP = '.windsurfrules.backup';

describe('WindsurfAdapter', () => {
  let adapter: WindsurfAdapter;
  let tmpDir: string;

  beforeEach(async () => {
    adapter = new WindsurfAdapter();
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('detect', () => {
    it('detects with confidence 0.9 when .windsurfrules exists', async () => {
      await fs.writeFile(path.join(tmpDir, TARGET), 'windsurf rules');
      const result = await adapter.detect(tmpDir);
      expect(result.detected).toBe(true);
      expect(result.confidence).toBe(0.9);
    });

    it('returns detected=false when .windsurfrules does not exist', async () => {
      const result = await adapter.detect(tmpDir);
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('returns detected=false for unrelated files', async () => {
      await fs.writeFile(path.join(tmpDir, '.cursorrules'), 'cursor rules');
      const result = await adapter.detect(tmpDir);
      expect(result.detected).toBe(false);
    });
  });

  describe('apply', () => {
    it('creates .windsurfrules with prompt content', async () => {
      const result = await adapter.apply(makePrompt('You are helpful.'), tmpDir);
      expect(result.success).toBe(true);

      const content = await fs.readFile(path.join(tmpDir, TARGET), 'utf-8');
      expect(content).toContain('You are helpful.');
    });

    it('includes managed-by header', async () => {
      await adapter.apply(makePrompt('Content here.'), tmpDir);
      const content = await fs.readFile(path.join(tmpDir, TARGET), 'utf-8');
      expect(content).toContain('managed by aiwright');
      expect(content).toContain('aiwright apply');
    });

    it('returns .windsurfrules path in outputPaths', async () => {
      const result = await adapter.apply(makePrompt('Test.'), tmpDir);
      expect(result.outputPaths[0]).toBe(path.join(tmpDir, TARGET));
    });

    it('backs up existing .windsurfrules if not managed by aiwright', async () => {
      const originalContent = 'original windsurf rules';
      await fs.writeFile(path.join(tmpDir, TARGET), originalContent);

      await adapter.apply(makePrompt('New rules.'), tmpDir);

      const backup = await fs.readFile(path.join(tmpDir, BACKUP), 'utf-8');
      expect(backup).toBe(originalContent);
    });

    it('does not create backup if file is already managed by aiwright', async () => {
      await adapter.apply(makePrompt('First version.'), tmpDir);
      await adapter.apply(makePrompt('Second version.'), tmpDir);

      const backupExists = await fs.stat(path.join(tmpDir, BACKUP))
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(false);
    });

    it('overwrites previous .windsurfrules on re-apply', async () => {
      await adapter.apply(makePrompt('First version.'), tmpDir);
      await adapter.apply(makePrompt('Second version.'), tmpDir);

      const content = await fs.readFile(path.join(tmpDir, TARGET), 'utf-8');
      expect(content).toContain('Second version.');
      expect(content).not.toContain('First version.');
    });
  });

  describe('read', () => {
    it('returns null when .windsurfrules does not exist', async () => {
      const result = await adapter.read(tmpDir);
      expect(result).toBeNull();
    });

    it('reads prompt content from .windsurfrules', async () => {
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
    it('returns success when .windsurfrules does not exist', async () => {
      const result = await adapter.remove(tmpDir);
      expect(result.success).toBe(true);
    });

    it('deletes .windsurfrules', async () => {
      await adapter.apply(makePrompt('To be removed.'), tmpDir);
      const result = await adapter.remove(tmpDir);
      expect(result.success).toBe(true);

      const exists = await fs.stat(path.join(tmpDir, TARGET)).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('restores from backup on remove if backup exists', async () => {
      const originalContent = 'original windsurf rules';
      await fs.writeFile(path.join(tmpDir, TARGET), originalContent);
      await adapter.apply(makePrompt('Managed content.'), tmpDir);

      await adapter.remove(tmpDir);

      const restored = await fs.readFile(path.join(tmpDir, TARGET), 'utf-8');
      expect(restored).toBe(originalContent);
    });

    it('removes backup file after restoring', async () => {
      await fs.writeFile(path.join(tmpDir, TARGET), 'original');
      await adapter.apply(makePrompt('Managed.'), tmpDir);
      await adapter.remove(tmpDir);

      const backupExists = await fs.stat(path.join(tmpDir, BACKUP))
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(false);
    });

    it('succeeds without restoring when no backup exists', async () => {
      await adapter.apply(makePrompt('Fresh managed.'), tmpDir);
      const result = await adapter.remove(tmpDir);
      expect(result.success).toBe(true);

      const exists = await fs.stat(path.join(tmpDir, TARGET)).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });
  });
});
