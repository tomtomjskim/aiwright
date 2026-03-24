import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const COMMIT_HASH_RE = /^[0-9a-f]{40}$/;

/**
 * git이 사용 가능한지 + HEAD 커밋 해시를 단일 호출로 반환
 * git 미사용 환경이면 null
 */
async function getHeadCommit(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { timeout: 5000 });
    const hash = stdout.trim();
    return COMMIT_HASH_RE.test(hash) ? hash : null;
  } catch {
    return null;
  }
}

/**
 * AI 메타데이터를 git notes에 추가
 * git이 없거나 실패하면 false 반환 (graceful fail)
 */
export async function addGitNote(data: {
  recipe: string;
  fragments: string[];
  dna_code?: string;
  score?: number;
}): Promise<boolean> {
  try {
    const commit = await getHeadCommit();
    if (!commit) return false;

    const parts: string[] = [`recipe=${data.recipe}`];
    if (data.dna_code) parts.push(`dna=${data.dna_code}`);
    if (data.score !== undefined) parts.push(`score=${data.score.toFixed(2)}`);
    if (data.fragments.length > 0) parts.push(`fragments=${data.fragments.join(',')}`);

    const noteMessage = `aiwright: ${parts.join(' ')}`;
    await execFileAsync('git', ['notes', '--ref=aiwright', 'add', '-f', '-m', noteMessage, commit], {
      timeout: 10000,
    });
    return true;
  } catch {
    return false;
  }
}

interface GitNoteEntry {
  commit: string;
  recipe: string;
  dna_code?: string;
  score?: number;
  fragments?: string[];
}

/**
 * git notes (aiwright ref)에서 메타데이터 읽기
 * count: 최근 N개 커밋 (기본값 10)
 */
export async function readGitNotes(count = 10): Promise<GitNoteEntry[]> {
  try {
    const commit = await getHeadCommit();
    if (!commit) return [];

    const { stdout } = await execFileAsync(
      'git',
      ['log', `--show-notes=aiwright`, `--format=%H%n%N---COMMIT_END---`, `-${count}`],
      { timeout: 10000 },
    );

    const entries: GitNoteEntry[] = [];
    const blocks = stdout.split('---COMMIT_END---').filter((b) => b.trim());

    for (const block of blocks) {
      const lines = block.trim().split('\n').filter((l) => l.trim());
      if (lines.length < 1) continue;

      const commitHash = lines[0].trim();
      if (!commitHash || commitHash.length < 7) continue;

      // aiwright: で始まるノートを探す
      const noteLine = lines.find((l) => l.includes('aiwright:'));
      if (!noteLine) continue;

      const noteContent = noteLine.replace(/.*aiwright:\s*/, '');
      const entry = parseNoteContent(commitHash, noteContent);
      if (entry) entries.push(entry);
    }

    return entries;
  } catch {
    return [];
  }
}

function parseNoteContent(commit: string, content: string): GitNoteEntry | null {
  try {
    const parts = content.trim().split(/\s+/);
    const map: Record<string, string> = {};

    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) continue;
      const key = part.slice(0, eqIdx);
      const value = part.slice(eqIdx + 1);
      map[key] = value;
    }

    if (!map['recipe']) return null;

    const entry: GitNoteEntry = {
      commit,
      recipe: map['recipe'],
    };

    if (map['dna']) entry.dna_code = map['dna'];
    if (map['score']) {
      const parsed = parseFloat(map['score']);
      if (!isNaN(parsed)) entry.score = parsed;
    }
    if (map['fragments']) {
      entry.fragments = map['fragments'].split(',').filter(Boolean);
    }

    return entry;
  } catch {
    return null;
  }
}
