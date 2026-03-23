import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';
import { loadProfile } from './storage.js';

export interface TeamMember {
  user_id: string;
  display_name?: string;
  dna_code?: string;
  total_events: number;
  avg_score?: number;
  strongest?: string;
  weakest?: string;
}

export interface TeamReport {
  members: TeamMember[];
  common_weaknesses: string[];
  best_practices: string[];
}

/** .aiwright/team/ 디렉토리 (프로젝트 루트 기준) */
function teamDir(projectDir: string): string {
  return join(projectDir, '.aiwright', 'team');
}

/**
 * 현재 프로파일을 팀 공유용 summary.yaml로 내보내기
 * 민감 정보 제거 (adaptive rules 등)
 */
export async function exportProfile(projectDir: string): Promise<string> {
  const profile = await loadProfile();
  if (!profile) {
    throw new Error('No profile found. Run `aiwright intelligence analyze` first.');
  }

  const dir = teamDir(projectDir);
  await mkdir(dir, { recursive: true });

  // 스타일 점수에서 strongest/weakest 계산
  const styleEntries: Array<[string, number]> = [
    ['verbosity', profile.style.verbosity],
    ['specificity', profile.style.specificity],
    ['context_ratio', profile.style.context_ratio],
    ['constraint_usage', profile.style.constraint_usage],
    ['example_usage', profile.style.example_usage],
    ['imperative_clarity', profile.style.imperative_clarity],
  ];

  const sorted = [...styleEntries].sort((a, b) => b[1] - a[1]);
  const strongest = sorted[0]?.[0];
  const weakest = sorted[sorted.length - 1]?.[0];

  // avg_score: domains의 평균
  let avg_score: number | undefined;
  if (profile.domains.length > 0) {
    const totalScore = profile.domains.reduce((s, d) => s + d.avg_score, 0);
    avg_score = totalScore / profile.domains.length;
  }

  // 민감 정보 제거: adaptive rules, weaknesses의 suggestion 등은 생략
  const summary: TeamMember & { weakness_ids?: string[] } = {
    user_id: profile.user_id,
    dna_code: profile.dna_code,
    total_events: profile.total_events,
    avg_score,
    strongest,
    weakest,
    weakness_ids: profile.weaknesses.map((w) => w.id),
  };

  const filePath = join(dir, `${profile.user_id}.summary.yaml`);
  const content = yaml.dump(summary, { lineWidth: 120 });
  await writeFile(filePath, content, 'utf-8');

  return filePath;
}

interface SummaryFile extends TeamMember {
  weakness_ids?: string[];
}

/**
 * .aiwright/team/*.summary.yaml 수집 후 TeamReport 집계
 */
export async function syncTeam(projectDir: string): Promise<TeamReport> {
  const dir = teamDir(projectDir);
  if (!existsSync(dir)) {
    return { members: [], common_weaknesses: [], best_practices: [] };
  }

  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return { members: [], common_weaknesses: [], best_practices: [] };
  }

  const summaryFiles = files.filter((f) => f.endsWith('.summary.yaml'));
  if (summaryFiles.length === 0) {
    return { members: [], common_weaknesses: [], best_practices: [] };
  }

  const members: TeamMember[] = [];
  const weaknessCounts = new Map<string, number>();
  const allSummaries: SummaryFile[] = [];

  for (const file of summaryFiles) {
    try {
      const raw = await readFile(join(dir, file), 'utf-8');
      const parsed = yaml.load(raw) as SummaryFile;
      if (!parsed || typeof parsed !== 'object' || !parsed.user_id) continue;

      const member: TeamMember = {
        user_id: parsed.user_id,
        display_name: parsed.display_name,
        dna_code: parsed.dna_code,
        total_events: parsed.total_events ?? 0,
        avg_score: parsed.avg_score,
        strongest: parsed.strongest,
        weakest: parsed.weakest,
      };
      members.push(member);
      allSummaries.push(parsed);

      // weakness 빈도 수집
      for (const wid of parsed.weakness_ids ?? []) {
        weaknessCounts.set(wid, (weaknessCounts.get(wid) ?? 0) + 1);
      }
    } catch {
      // 파일 파싱 실패 무시
    }
  }

  // common_weaknesses: 2명 이상 공유하는 weakness
  const common_weaknesses: string[] = [];
  for (const [wid, count] of weaknessCounts.entries()) {
    if (count >= 2) {
      common_weaknesses.push(wid);
    }
  }

  // best_practices: avg_score 가장 높은 멤버의 특징
  const best_practices: string[] = [];
  const withScore = members.filter((m) => m.avg_score !== undefined);
  if (withScore.length > 0) {
    const best = withScore.reduce((max, m) =>
      (m.avg_score ?? 0) > (max.avg_score ?? 0) ? m : max,
    );
    if (best.strongest) {
      best_practices.push(`High ${best.strongest} (top performer: ${best.user_id})`);
    }
    if (best.dna_code) {
      best_practices.push(`DNA pattern: ${best.dna_code}`);
    }
  }

  return { members, common_weaknesses, best_practices };
}

/**
 * 팀 대시보드 ASCII 테이블 렌더링
 */
export function renderTeamDashboard(report: TeamReport): string {
  const lines: string[] = [];

  if (report.members.length === 0) {
    lines.push('No team members found.');
    lines.push('Run `aiwright intelligence export` to share your profile,');
    lines.push('then commit .aiwright/team/ to your repository.');
    return lines.join('\n');
  }

  const COL_MEMBER = 12;
  const COL_DNA = 8;
  const COL_STRENGTH = 14;
  const COL_WEAKNESS = 14;
  const COL_EVENTS = 8;

  function pad(s: string, len: number): string {
    if (s.length >= len) return s.slice(0, len - 1) + ' ';
    return s + ' '.repeat(len - s.length);
  }

  const sep =
    '┌' +
    '─'.repeat(COL_MEMBER + 1) +
    '┬' +
    '─'.repeat(COL_DNA + 1) +
    '┬' +
    '─'.repeat(COL_STRENGTH + 1) +
    '┬' +
    '─'.repeat(COL_WEAKNESS + 1) +
    '┬' +
    '─'.repeat(COL_EVENTS + 1) +
    '┐';

  const mid =
    '├' +
    '─'.repeat(COL_MEMBER + 1) +
    '┼' +
    '─'.repeat(COL_DNA + 1) +
    '┼' +
    '─'.repeat(COL_STRENGTH + 1) +
    '┼' +
    '─'.repeat(COL_WEAKNESS + 1) +
    '┼' +
    '─'.repeat(COL_EVENTS + 1) +
    '┤';

  const bot =
    '└' +
    '─'.repeat(COL_MEMBER + 1) +
    '┴' +
    '─'.repeat(COL_DNA + 1) +
    '┴' +
    '─'.repeat(COL_STRENGTH + 1) +
    '┴' +
    '─'.repeat(COL_WEAKNESS + 1) +
    '┴' +
    '─'.repeat(COL_EVENTS + 1) +
    '┘';

  function row(member: string, dna: string, strength: string, weakness: string, events: string): string {
    return (
      '│ ' +
      pad(member, COL_MEMBER) +
      '│ ' +
      pad(dna, COL_DNA) +
      '│ ' +
      pad(strength, COL_STRENGTH) +
      '│ ' +
      pad(weakness, COL_WEAKNESS) +
      '│ ' +
      pad(events, COL_EVENTS) +
      '│'
    );
  }

  lines.push(sep);
  lines.push(row('Member', 'DNA', 'Strength', 'Weakness', 'Events'));
  lines.push(mid);

  for (const m of report.members) {
    const name = m.display_name ?? m.user_id;
    const dna = m.dna_code ? m.dna_code.replace('AW-', '') : '-';
    const strength = m.strongest ?? '-';
    const weakness = m.weakest ?? '-';
    const events = String(m.total_events);
    lines.push(row(name, dna, strength, weakness, events));
  }

  lines.push(bot);

  if (report.common_weaknesses.length > 0) {
    lines.push('');
    lines.push(`Common gap: ${report.common_weaknesses.join(', ')}`);
  }

  if (report.best_practices.length > 0) {
    lines.push('');
    lines.push('Best practices:');
    for (const bp of report.best_practices) {
      lines.push(`  • ${bp}`);
    }
  }

  return lines.join('\n');
}
