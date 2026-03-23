import path from 'node:path';
import os from 'node:os';
import { fileExists, listFiles } from '../utils/fs.js';
import { FragmentNotFoundError } from '../utils/errors.js';

export interface ResolveOptions {
  projectDir: string;
  /** default: ~/.aiwright/fragments */
  globalDir?: string;
  /** 내장 Fragment 디렉터리 (패키지 내부) */
  builtinsDir?: string;
}

export type FragmentLayer = 'local' | 'global' | 'builtin';

export interface ResolveResult {
  path: string;
  layer: FragmentLayer;
}

function defaultGlobalDir(): string {
  return path.join(os.homedir(), '.aiwright', 'fragments');
}

function defaultBuiltinsDir(): string {
  // dist/builtins (빌드 후) 또는 src/builtins (직접 실행)
  return new URL('./builtins', import.meta.url).pathname;
}

/**
 * Fragment name → 파일 경로 해결
 * 탐색 순서: project-local → user-global → builtins
 * local-wins 정책: local에 있으면 global/builtin 무시
 */
export async function resolveFragment(
  name: string,
  options: ResolveOptions,
): Promise<ResolveResult> {
  const localDir =
    options.projectDir
      ? path.join(options.projectDir, '.aiwright', 'fragments')
      : '';
  const globalDir = options.globalDir ?? defaultGlobalDir();
  const builtinsDir = options.builtinsDir ?? defaultBuiltinsDir();

  const candidates: Array<{ filePath: string; layer: FragmentLayer }> = [
    { filePath: path.join(localDir, `${name}.md`), layer: 'local' },
    { filePath: path.join(globalDir, `${name}.md`), layer: 'global' },
    { filePath: path.join(builtinsDir, `${name}.md`), layer: 'builtin' },
  ];

  for (const { filePath, layer } of candidates) {
    if (await fileExists(filePath)) {
      return { path: filePath, layer };
    }
  }

  // 유사 이름 제안
  const allNames = await resolveAllNames({ projectDir: options.projectDir, globalDir, builtinsDir: options.builtinsDir });
  const similar = suggestSimilar(name, allNames);
  const suggestionStr =
    similar.length > 0
      ? `Did you mean: ${similar.map((s) => `"${s}"`).join(', ')}?`
      : `Run "aiwright list" to see available fragments`;

  throw new FragmentNotFoundError(name, suggestionStr);
}

/**
 * 모든 계층의 Fragment 이름 목록 반환
 */
export async function resolveAllNames(options: ResolveOptions): Promise<string[]> {
  const localDir = path.join(options.projectDir, '.aiwright', 'fragments');
  const globalDir = options.globalDir ?? defaultGlobalDir();
  const builtinsDir = options.builtinsDir ?? defaultBuiltinsDir();

  const dirs = [localDir, globalDir, builtinsDir];
  const seen = new Set<string>();

  for (const dir of dirs) {
    const files = await listFiles(dir, '.md');
    for (const f of files) {
      seen.add(path.basename(f, '.md'));
    }
  }

  return Array.from(seen);
}

/**
 * 모든 Fragment 파일 경로 반환 (local-wins)
 */
export async function resolveAllFragments(
  options: ResolveOptions,
): Promise<ResolveResult[]> {
  const localDir = path.join(options.projectDir, '.aiwright', 'fragments');
  const globalDir = options.globalDir ?? defaultGlobalDir();
  const builtinsDir = options.builtinsDir ?? defaultBuiltinsDir();

  const results = new Map<string, ResolveResult>();

  const layers: Array<{ dir: string; layer: FragmentLayer }> = [
    { dir: builtinsDir, layer: 'builtin' },
    { dir: globalDir, layer: 'global' },
    { dir: localDir, layer: 'local' },
  ];

  for (const { dir, layer } of layers) {
    const files = await listFiles(dir, '.md');
    for (const filePath of files) {
      const name = path.basename(filePath, '.md');
      results.set(name, { path: filePath, layer });
    }
  }

  return Array.from(results.values());
}

/**
 * levenshtein 거리 기반 유사 이름 제안 (최대 3개)
 */
export function suggestSimilar(name: string, candidates: string[]): string[] {
  function levenshtein(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  }

  return candidates
    .map((c) => ({ name: c, dist: levenshtein(name, c) }))
    .filter(({ dist }) => dist <= 3)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map(({ name: n }) => n);
}
