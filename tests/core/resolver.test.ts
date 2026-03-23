import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { resolveFragment, resolveAllFragments, resolveAllNames, suggestSimilar } from '../../src/core/resolver.js';
import { FragmentNotFoundError } from '../../src/utils/errors.js';

async function makeTmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'aiwright-test-'));
}

describe('suggestSimilar', () => {
  it('returns exact match when present', () => {
    const suggestions = suggestSimilar('system-role', ['system-role', 'constraint', 'output']);
    expect(suggestions).toContain('system-role');
  });

  it('suggests similar names within edit distance 3', () => {
    const suggestions = suggestSimilar('systemrole', ['system-role', 'constraint', 'output']);
    expect(suggestions).toContain('system-role');
  });

  it('returns empty array when no similar names exist', () => {
    const suggestions = suggestSimilar('zzzzunknown', ['system-role', 'constraint', 'output']);
    expect(suggestions).toEqual([]);
  });

  it('limits results to maximum 3 suggestions', () => {
    const candidates = ['abc', 'abd', 'abe', 'abf', 'abg'];
    const suggestions = suggestSimilar('abc', candidates);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it('returns empty array for empty candidates', () => {
    const suggestions = suggestSimilar('test', []);
    expect(suggestions).toEqual([]);
  });
});

describe('resolveFragment', () => {
  let tmpDir: string;
  let localFragmentsDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
    localFragmentsDir = path.join(tmpDir, '.aiwright', 'fragments');
    await fs.mkdir(localFragmentsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('resolves a fragment that exists in local directory', async () => {
    const fragPath = path.join(localFragmentsDir, 'my-frag.md');
    await fs.writeFile(fragPath, '---\nname: my-frag\ndescription: test\n---\nBody');

    const result = await resolveFragment('my-frag', {
      projectDir: tmpDir,
      globalDir: path.join(tmpDir, 'global'),
      builtinsDir: path.join(tmpDir, 'builtins'),
    });

    expect(result.layer).toBe('local');
    expect(result.path).toBe(fragPath);
  });

  it('throws FragmentNotFoundError for non-existent fragment', async () => {
    await expect(
      resolveFragment('non-existent', {
        projectDir: tmpDir,
        globalDir: path.join(tmpDir, 'global'),
        builtinsDir: path.join(tmpDir, 'builtins'),
      })
    ).rejects.toThrow(FragmentNotFoundError);
  });

  it('resolves from global layer when not in local', async () => {
    const globalDir = path.join(tmpDir, 'global');
    await fs.mkdir(globalDir, { recursive: true });
    const fragPath = path.join(globalDir, 'global-frag.md');
    await fs.writeFile(fragPath, '---\nname: global-frag\ndescription: test\n---\nBody');

    const result = await resolveFragment('global-frag', {
      projectDir: tmpDir,
      globalDir,
      builtinsDir: path.join(tmpDir, 'builtins'),
    });

    expect(result.layer).toBe('global');
    expect(result.path).toBe(fragPath);
  });

  it('resolves from builtin layer when not in local or global', async () => {
    const builtinsDir = path.join(tmpDir, 'builtins');
    await fs.mkdir(builtinsDir, { recursive: true });
    const fragPath = path.join(builtinsDir, 'builtin-frag.md');
    await fs.writeFile(fragPath, '---\nname: builtin-frag\ndescription: test\n---\nBody');

    const result = await resolveFragment('builtin-frag', {
      projectDir: tmpDir,
      globalDir: path.join(tmpDir, 'global'),
      builtinsDir,
    });

    expect(result.layer).toBe('builtin');
    expect(result.path).toBe(fragPath);
  });

  it('local fragment wins over global with same name', async () => {
    const globalDir = path.join(tmpDir, 'global');
    await fs.mkdir(globalDir, { recursive: true });

    const localPath = path.join(localFragmentsDir, 'shared.md');
    const globalPath = path.join(globalDir, 'shared.md');
    await fs.writeFile(localPath, '---\nname: shared\ndescription: local\n---\nLocal body');
    await fs.writeFile(globalPath, '---\nname: shared\ndescription: global\n---\nGlobal body');

    const result = await resolveFragment('shared', {
      projectDir: tmpDir,
      globalDir,
      builtinsDir: path.join(tmpDir, 'builtins'),
    });

    expect(result.layer).toBe('local');
    expect(result.path).toBe(localPath);
  });
});

describe('resolveAllFragments', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no fragments exist', async () => {
    const results = await resolveAllFragments({
      projectDir: tmpDir,
      globalDir: path.join(tmpDir, 'global'),
      builtinsDir: path.join(tmpDir, 'builtins'),
    });
    expect(results).toEqual([]);
  });

  it('returns fragments from all layers without duplicates', async () => {
    const localDir = path.join(tmpDir, '.aiwright', 'fragments');
    const builtinsDir = path.join(tmpDir, 'builtins');
    await fs.mkdir(localDir, { recursive: true });
    await fs.mkdir(builtinsDir, { recursive: true });

    await fs.writeFile(path.join(localDir, 'local-only.md'), '---\nname: local-only\ndescription: x\n---\nBody');
    await fs.writeFile(path.join(builtinsDir, 'builtin-only.md'), '---\nname: builtin-only\ndescription: x\n---\nBody');

    const results = await resolveAllFragments({
      projectDir: tmpDir,
      globalDir: path.join(tmpDir, 'global'),
      builtinsDir,
    });

    const names = results.map((r) => path.basename(r.path, '.md'));
    expect(names).toContain('local-only');
    expect(names).toContain('builtin-only');
  });
});

describe('resolveAllNames', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTmpDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns names from all layers', async () => {
    const localDir = path.join(tmpDir, '.aiwright', 'fragments');
    await fs.mkdir(localDir, { recursive: true });
    await fs.writeFile(path.join(localDir, 'alpha.md'), 'content');

    const names = await resolveAllNames({
      projectDir: tmpDir,
      globalDir: path.join(tmpDir, 'global'),
      builtinsDir: path.join(tmpDir, 'builtins'),
    });

    expect(names).toContain('alpha');
  });

  it('deduplicates names across layers', async () => {
    const localDir = path.join(tmpDir, '.aiwright', 'fragments');
    const builtinsDir = path.join(tmpDir, 'builtins');
    await fs.mkdir(localDir, { recursive: true });
    await fs.mkdir(builtinsDir, { recursive: true });
    await fs.writeFile(path.join(localDir, 'shared.md'), 'content');
    await fs.writeFile(path.join(builtinsDir, 'shared.md'), 'content');

    const names = await resolveAllNames({
      projectDir: tmpDir,
      globalDir: path.join(tmpDir, 'global'),
      builtinsDir,
    });

    const count = names.filter((n) => n === 'shared').length;
    expect(count).toBe(1);
  });
});
