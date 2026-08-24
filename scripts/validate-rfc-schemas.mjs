#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const schemaRoot = path.join(
  repoRoot,
  'docs',
  'rfcs',
  'aiwright-platform',
  'schemas',
);

const errors = [];
const parsed = new Map();
const ids = new Map();
let referenceCount = 0;

function fail(file, location, message) {
  errors.push(`${path.relative(repoRoot, file)}${location}: ${message}`);
}

function decodeJsonPointerToken(token) {
  return token.replaceAll('~1', '/').replaceAll('~0', '~');
}

function resolveJsonPointer(document, fragment) {
  if (fragment === '' || fragment === '#') {
    return document;
  }

  const pointer = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  if (!pointer.startsWith('/')) {
    throw new Error(`unsupported JSON Schema fragment: ${fragment}`);
  }

  return pointer
    .slice(1)
    .split('/')
    .map(decodeJsonPointerToken)
    .reduce((current, key) => {
      if (current === null || typeof current !== 'object' || !(key in current)) {
        throw new Error(`JSON Pointer target does not exist: ${fragment}`);
      }
      return current[key];
    }, document);
}

async function loadSchema(file) {
  const normalized = path.resolve(file);
  if (parsed.has(normalized)) {
    return parsed.get(normalized);
  }

  let text;
  try {
    text = await readFile(normalized, 'utf8');
  } catch (error) {
    throw new Error(`cannot read referenced schema: ${error.message}`);
  }

  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid JSON: ${error.message}`);
  }

  parsed.set(normalized, document);
  return document;
}

function walk(value, visitor, location = '#') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, visitor, `${location}/${index}`));
    return;
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  visitor(value, location);
  for (const [key, entry] of Object.entries(value)) {
    walk(entry, visitor, `${location}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
  }
}

async function validateReference(sourceFile, location, reference) {
  referenceCount += 1;

  if (reference.startsWith('#')) {
    const sourceDocument = await loadSchema(sourceFile);
    try {
      resolveJsonPointer(sourceDocument, reference);
    } catch (error) {
      fail(sourceFile, location, error.message);
    }
    return;
  }

  if (reference.startsWith('http://') || reference.startsWith('https://') || reference.startsWith('urn:')) {
    fail(sourceFile, location, `external $ref is not allowed in the local-core catalog: ${reference}`);
    return;
  }

  const [relativeFile, fragment = ''] = reference.split('#', 2);
  const targetFile = path.resolve(path.dirname(sourceFile), relativeFile);
  const relativeTarget = path.relative(schemaRoot, targetFile);

  if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
    fail(sourceFile, location, `$ref escapes schema directory: ${reference}`);
    return;
  }

  let targetDocument;
  try {
    targetDocument = await loadSchema(targetFile);
  } catch (error) {
    fail(sourceFile, location, error.message);
    return;
  }

  try {
    resolveJsonPointer(targetDocument, fragment === '' ? '#' : `#${fragment}`);
  } catch (error) {
    fail(sourceFile, location, error.message);
  }
}

async function main() {
  const entries = await readdir(schemaRoot, { withFileTypes: true });
  const schemaFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.schema.json'))
    .map((entry) => path.join(schemaRoot, entry.name))
    .sort();

  if (schemaFiles.length === 0) {
    throw new Error(`no schema files found under ${schemaRoot}`);
  }

  for (const file of schemaFiles) {
    let document;
    try {
      document = await loadSchema(file);
    } catch (error) {
      fail(file, '#', error.message);
      continue;
    }

    if (document.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
      fail(file, '#/$schema', 'schema dialect must be JSON Schema 2020-12');
    }

    if (typeof document.$id !== 'string' || document.$id.length === 0) {
      fail(file, '#/$id', 'non-empty $id is required');
    } else if (ids.has(document.$id)) {
      fail(file, '#/$id', `duplicate $id also used by ${path.relative(repoRoot, ids.get(document.$id))}`);
    } else {
      ids.set(document.$id, file);
    }

    const pending = [];
    walk(document, (node, location) => {
      if ('$ref' in node) {
        if (typeof node.$ref !== 'string' || node.$ref.length === 0) {
          fail(file, `${location}/$ref`, '$ref must be a non-empty string');
          return;
        }
        pending.push(validateReference(file, `${location}/$ref`, node.$ref));
      }
    });
    await Promise.all(pending);
  }

  if (errors.length > 0) {
    console.error(`RFC schema validation failed with ${errors.length} error(s):`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(
    `RFC schema validation passed: ${schemaFiles.length} schema files, ${ids.size} unique $id values, ${referenceCount} resolved $ref values.`,
  );
}

main().catch((error) => {
  console.error(`RFC schema validation failed: ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
