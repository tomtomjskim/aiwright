import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { loadFragment, loadFragments } from '../../src/core/loader.js';
import { InvalidFragmentError } from '../../src/utils/errors.js';

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-loader-test-'));
}

describe('loadFragment', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('loads a valid fragment file with proper frontmatter', async () => {
    const fragPath = path.join(tmpDir, 'valid.md');
    await fs.writeFile(
      fragPath,
      `---
name: valid-frag
description: A valid test fragment
slot: instruction
priority: 30
---
This is the body content of the fragment.`
    );

    const result = await loadFragment(fragPath);
    expect(result.meta.name).toBe('valid-frag');
    expect(result.meta.description).toBe('A valid test fragment');
    expect(result.meta.slot).toBe('instruction');
    expect(result.meta.priority).toBe(30);
    expect(result.body).toBe('This is the body content of the fragment.');
  });

  it('applies schema defaults when optional fields are missing', async () => {
    const fragPath = path.join(tmpDir, 'minimal.md');
    await fs.writeFile(
      fragPath,
      `---
name: minimal-frag
description: Minimal fragment
---
Minimal body content.`
    );

    const result = await loadFragment(fragPath);
    expect(result.meta.version).toBe('0.1.0');
    expect(result.meta.priority).toBe(50);
    expect(result.meta.slot).toBe('instruction');
    expect(result.meta.tags).toEqual([]);
    expect(result.meta.conflicts_with).toEqual([]);
  });

  it('throws InvalidFragmentError when file does not exist', async () => {
    await expect(loadFragment(path.join(tmpDir, 'nonexistent.md'))).rejects.toThrow(InvalidFragmentError);
  });

  it('throws InvalidFragmentError when body is empty', async () => {
    const fragPath = path.join(tmpDir, 'empty-body.md');
    await fs.writeFile(
      fragPath,
      `---
name: empty-body
description: Fragment with empty body
---`
    );
    await expect(loadFragment(fragPath)).rejects.toThrow(InvalidFragmentError);
  });

  it('throws InvalidFragmentError when name field is missing in frontmatter', async () => {
    const fragPath = path.join(tmpDir, 'invalid-no-name.md');
    await fs.writeFile(
      fragPath,
      `---
description: No name fragment
---
Some body content.`
    );
    await expect(loadFragment(fragPath)).rejects.toThrow(InvalidFragmentError);
  });

  it('throws InvalidFragmentError when name has invalid format (uppercase)', async () => {
    const fragPath = path.join(tmpDir, 'invalid-name.md');
    await fs.writeFile(
      fragPath,
      `---
name: InvalidName
description: Invalid name fragment
---
Body content.`
    );
    await expect(loadFragment(fragPath)).rejects.toThrow(InvalidFragmentError);
  });

  it('loads fixture valid-system.md correctly', async () => {
    const fixturePath = path.join(
      new URL('.', import.meta.url).pathname,
      '../fixtures/fragments/valid-system.md'
    );
    const result = await loadFragment(fixturePath);
    expect(result.meta.name).toBe('valid-system');
    expect(result.meta.slot).toBe('system');
    expect(result.body.length).toBeGreaterThan(0);
  });

  it('loads fixture valid-constraint.md with variable definition', async () => {
    const fixturePath = path.join(
      new URL('.', import.meta.url).pathname,
      '../fixtures/fragments/valid-constraint.md'
    );
    const result = await loadFragment(fixturePath);
    expect(result.meta.name).toBe('valid-constraint');
    expect(result.meta.variables).toHaveProperty('tone');
    expect(result.meta.conflicts_with).toContain('conflicting-fragment');
  });

  it('throws InvalidFragmentError for fixture invalid-no-name.md', async () => {
    const fixturePath = path.join(
      new URL('.', import.meta.url).pathname,
      '../fixtures/fragments/invalid-no-name.md'
    );
    await expect(loadFragment(fixturePath)).rejects.toThrow(InvalidFragmentError);
  });
});

describe('loadFragments', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('loads multiple fragment files in parallel', async () => {
    const paths = await Promise.all(
      ['frag-a', 'frag-b', 'frag-c'].map(async (name) => {
        const p = path.join(tmpDir, `${name}.md`);
        await fs.writeFile(p, `---\nname: ${name}\ndescription: test\n---\nBody of ${name}`);
        return p;
      })
    );

    const results = await loadFragments(paths);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.meta.name)).toContain('frag-a');
    expect(results.map((r) => r.meta.name)).toContain('frag-c');
  });

  it('throws when any file in the array is invalid', async () => {
    const validPath = path.join(tmpDir, 'valid.md');
    await fs.writeFile(validPath, '---\nname: valid\ndescription: test\n---\nBody');
    const invalidPath = path.join(tmpDir, 'nonexistent.md');

    await expect(loadFragments([validPath, invalidPath])).rejects.toThrow(InvalidFragmentError);
  });
});
