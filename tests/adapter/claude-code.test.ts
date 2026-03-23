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
  const sections = new Map<string, string>();
  sections.set('full', fullText);
  return {
    sections,
    fullText,
    fragments: ['test-frag'],
    resolvedVars: {},
  };
}

const MARKER_START = '<!-- aiwright:start -->';
const MARKER_END = '<!-- aiwright:end -->';

describe('ClaudeCodeAdapter', () => {
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
    it('detects with high confidence when .claude/ directory exists', async () => {
      await fs.mkdir(path.join(tmpDir, '.claude'), { recursive: true });
      const result = await adapter.detect(tmpDir);
      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('detects with lower confidence when only CLAUDE.md exists (no .claude/)', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Project Claude Config');
      const result = await adapter.detect(tmpDir);
      expect(result.detected).toBe(true);
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('returns detected=false when neither .claude/ nor CLAUDE.md exist', async () => {
      const result = await adapter.detect(tmpDir);
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('provides a reason string in all cases', async () => {
      const result = await adapter.detect(tmpDir);
      expect(typeof result.reason).toBe('string');
      expect(result.reason.length).toBeGreaterThan(0);
    });
  });

  describe('apply', () => {
    it('creates a new CLAUDE.md with aiwright markers when file does not exist', async () => {
      const prompt = makePrompt('You are a helpful assistant.');
      const result = await adapter.apply(prompt, tmpDir);

      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
      expect(content).toContain(MARKER_START);
      expect(content).toContain(MARKER_END);
      expect(content).toContain('You are a helpful assistant.');
    });

    it('appends to existing CLAUDE.md that has no markers', async () => {
      const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(claudeMdPath, '# Existing content\n\nSome project notes.');

      const prompt = makePrompt('New prompt content.');
      await adapter.apply(prompt, tmpDir);

      const content = await fs.readFile(claudeMdPath, 'utf-8');
      expect(content).toContain('# Existing content');
      expect(content).toContain(MARKER_START);
      expect(content).toContain('New prompt content.');
    });

    it('replaces existing aiwright marker section without losing surrounding content', async () => {
      const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
      const existing = `# Header\n\n${MARKER_START}\nOld content.\n${MARKER_END}\n\n## Footer`;
      await fs.writeFile(claudeMdPath, existing);

      const prompt = makePrompt('Updated content.');
      await adapter.apply(prompt, tmpDir);

      const content = await fs.readFile(claudeMdPath, 'utf-8');
      expect(content).toContain('# Header');
      expect(content).toContain('## Footer');
      expect(content).toContain('Updated content.');
      expect(content).not.toContain('Old content.');
    });

    it('returns the CLAUDE.md path in outputPaths', async () => {
      const prompt = makePrompt('Some prompt.');
      const result = await adapter.apply(prompt, tmpDir);
      expect(result.outputPaths).toContain(path.join(tmpDir, 'CLAUDE.md'));
    });
  });

  describe('read', () => {
    it('returns null when CLAUDE.md does not exist', async () => {
      const result = await adapter.read(tmpDir);
      expect(result).toBeNull();
    });

    it('returns null when CLAUDE.md has no aiwright markers', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# No markers here');
      const result = await adapter.read(tmpDir);
      expect(result).toBeNull();
    });

    it('extracts content between aiwright markers', async () => {
      const innerContent = 'This is the aiwright-managed prompt.';
      await fs.writeFile(
        path.join(tmpDir, 'CLAUDE.md'),
        `# Header\n\n${MARKER_START}\n${innerContent}\n${MARKER_END}\n\n## Footer`
      );

      const result = await adapter.read(tmpDir);
      expect(result).not.toBeNull();
      expect(result!.fullText).toBe(innerContent);
    });

    it('returns a ComposedPrompt with sections map containing "full" key', async () => {
      const innerContent = 'Managed content here.';
      await fs.writeFile(
        path.join(tmpDir, 'CLAUDE.md'),
        `${MARKER_START}\n${innerContent}\n${MARKER_END}`
      );

      const result = await adapter.read(tmpDir);
      expect(result!.sections.has('full')).toBe(true);
    });
  });

  describe('remove', () => {
    it('returns success when CLAUDE.md does not exist', async () => {
      const result = await adapter.remove(tmpDir);
      expect(result.success).toBe(true);
    });

    it('returns success without modification when no markers exist', async () => {
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# No markers');
      const result = await adapter.remove(tmpDir);
      expect(result.success).toBe(true);
      const content = await fs.readFile(path.join(tmpDir, 'CLAUDE.md'), 'utf-8');
      expect(content).toBe('# No markers');
    });

    it('removes aiwright marker section from CLAUDE.md', async () => {
      const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(
        claudeMdPath,
        `# Header\n\n${MARKER_START}\nManaged prompt content.\n${MARKER_END}\n\n## Footer`
      );

      const result = await adapter.remove(tmpDir);
      expect(result.success).toBe(true);

      const content = await fs.readFile(claudeMdPath, 'utf-8');
      expect(content).toContain('# Header');
      expect(content).toContain('## Footer');
      expect(content).not.toContain(MARKER_START);
      expect(content).not.toContain(MARKER_END);
      expect(content).not.toContain('Managed prompt content.');
    });

    it('produces empty file when markers are the only content', async () => {
      const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
      await fs.writeFile(
        claudeMdPath,
        `${MARKER_START}\nOnly content.\n${MARKER_END}\n`
      );

      await adapter.remove(tmpDir);
      const content = await fs.readFile(claudeMdPath, 'utf-8');
      expect(content.trim()).toBe('');
    });
  });
});
