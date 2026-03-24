import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { detectAdapter } from '../../src/adapter/detect.js';

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-detect-test-'));
}

describe('detectAdapter', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns claude-code adapter when .claude/ directory exists', async () => {
    await fs.mkdir(path.join(tmpDir, '.claude'), { recursive: true });
    const adapter = await detectAdapter(tmpDir);
    expect(adapter.name).toBe('claude-code');
  });

  it('returns cursor adapter when .cursorrules file exists', async () => {
    await fs.writeFile(path.join(tmpDir, '.cursorrules'), 'cursor rules');
    const adapter = await detectAdapter(tmpDir);
    expect(adapter.name).toBe('cursor');
  });

  it('returns generic adapter when no adapter-specific files exist', async () => {
    // tmpDir is empty — no .claude/, .cursorrules, .windsurfrules, etc.
    const adapter = await detectAdapter(tmpDir);
    expect(adapter.name).toBe('generic');
  });

  it('returns claude-code over cursor when both .claude/ and .cursorrules exist (confidence 0.95 > 0.9)', async () => {
    await fs.mkdir(path.join(tmpDir, '.claude'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, '.cursorrules'), 'cursor rules');
    const adapter = await detectAdapter(tmpDir);
    expect(adapter.name).toBe('claude-code');
  });

  it('returns windsurf adapter when .windsurfrules exists', async () => {
    await fs.writeFile(path.join(tmpDir, '.windsurfrules'), 'windsurf rules');
    const adapter = await detectAdapter(tmpDir);
    expect(adapter.name).toBe('windsurf');
  });

  it('returns claude-code over windsurf when both .claude/ and .windsurfrules exist', async () => {
    await fs.mkdir(path.join(tmpDir, '.claude'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, '.windsurfrules'), 'windsurf rules');
    const adapter = await detectAdapter(tmpDir);
    expect(adapter.name).toBe('claude-code');
  });
});
