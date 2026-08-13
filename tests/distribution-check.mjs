import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(
  await readFile(path.join(projectDir, 'package.json'), 'utf8'),
);
const require = createRequire(import.meta.url);

const resolveTarget = (target) => path.resolve(projectDir, target);
const esmEntry = resolveTarget(packageJson.exports['.'].import);
const cjsEntry = resolveTarget(packageJson.exports['.'].require);
const cliEntry = resolveTarget(packageJson.bin.aiwright);

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'aiwright-dist-'));

try {
  const esm = await import(pathToFileURL(esmEntry).href);
  const cjs = require(cjsEntry);

  for (const [format, module] of [
    ['ESM', esm],
    ['CommonJS', cjs],
  ]) {
    const resolved = await module.resolveFragment('constraint-concise', {
      projectDir: tempDir,
      globalDir: path.join(tempDir, 'global'),
    });

    assert.equal(resolved.layer, 'builtin', `${format} should load bundled fragments`);
    assert.equal(path.basename(resolved.path), 'constraint-concise.md');
  }

  const cli = spawnSync(process.execPath, [cliEntry, '--version'], {
    encoding: 'utf8',
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(cli.stdout.trim(), packageJson.version);
  console.log('Distribution check passed for package entries and bundled fragments.');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
