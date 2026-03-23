import { defineConfig } from 'tsup';
import { cpSync } from 'node:fs';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    onSuccess: async () => {
      cpSync('src/builtins', 'dist/builtins', { recursive: true });
      cpSync('src/boilerplate', 'dist/boilerplate', { recursive: true });
    },
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['esm'],
    banner: { js: '#!/usr/bin/env node' },
    sourcemap: true,
  },
]);
