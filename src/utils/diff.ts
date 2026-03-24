import chalk from 'chalk';

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
}

/**
 * LCS(Longest Common Subsequence) 기반 라인 단위 diff 계산.
 * O(m×n) DP 테이블 + 역추적. 외부 의존성 없이 직접 구현.
 */
export function computeDiff(oldText: string, newText: string): DiffLine[] {
  // 빈 입력 처리
  if (oldText === '' && newText === '') return [];

  const oldLines = oldText === '' ? [] : oldText.split('\n');
  const newLines = newText === '' ? [] : newText.split('\n');

  const m = oldLines.length;
  const n = newLines.length;

  // LCS 길이 테이블 (공간 절약: 2행만 유지)
  // dp[i][j] = oldLines[0..i-1], newLines[0..j-1]의 LCS 길이
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 역추적으로 diff 라인 생성
  const result: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'context', content: oldLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', content: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: 'remove', content: oldLines[i - 1] });
      i--;
    }
  }

  result.reverse();
  return result;
}

const CONTEXT_LINES = 3;

/**
 * DiffLine[] 배열을 unified diff 스타일로 포맷팅.
 * 변경 없는 라인은 앞뒤 CONTEXT_LINES(3)줄만 표시하고 나머지는 생략.
 * chalk 색상 포함: add=green, remove=red, context=dim.
 */
export function formatDiff(lines: DiffLine[]): string {
  if (lines.length === 0) return chalk.dim('(no changes)');

  // 변경 라인(add/remove) 인덱스 집합
  const changedIndices = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== 'context') changedIndices.add(i);
  }

  // 변경이 전혀 없으면 (모두 context)
  if (changedIndices.size === 0) return chalk.dim('(no changes)');

  // 표시할 인덱스 집합: 변경 라인 ± CONTEXT_LINES
  const visibleIndices = new Set<number>();
  for (const idx of changedIndices) {
    for (let offset = -CONTEXT_LINES; offset <= CONTEXT_LINES; offset++) {
      const target = idx + offset;
      if (target >= 0 && target < lines.length) {
        visibleIndices.add(target);
      }
    }
  }

  const output: string[] = [];
  let prevVisible = -2; // 이전에 출력한 인덱스

  const sortedVisible = Array.from(visibleIndices).sort((a, b) => a - b);

  for (const idx of sortedVisible) {
    // 첫 항목이 인덱스 0이 아니거나, 연속되지 않는 경우 구분선 출력
    if (prevVisible === -2 ? idx > 0 : idx > prevVisible + 1) {
      output.push(chalk.cyan('@@ ... @@'));
    }

    const line = lines[idx];
    switch (line.type) {
      case 'add':
        output.push(chalk.green(`+ ${line.content}`));
        break;
      case 'remove':
        output.push(chalk.red(`- ${line.content}`));
        break;
      case 'context':
        output.push(chalk.dim(`  ${line.content}`));
        break;
    }

    prevVisible = idx;
  }

  return output.join('\n');
}
