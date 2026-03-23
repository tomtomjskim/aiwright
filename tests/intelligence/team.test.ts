import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import yaml from 'js-yaml';
import { syncTeam, renderTeamDashboard, type TeamReport, type TeamMember } from '../../src/intelligence/team.js';

async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'aiwright-team-test-'));
}

async function writeSummary(dir: string, userId: string, data: Record<string, unknown>): Promise<void> {
  const teamDir = join(dir, '.aiwright', 'team');
  await mkdir(teamDir, { recursive: true });
  const content = yaml.dump({ user_id: userId, ...data });
  await writeFile(join(teamDir, `${userId}.summary.yaml`), content, 'utf-8');
}

describe('syncTeam', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('summary 파일 없으면 빈 report 반환', async () => {
    const report = await syncTeam(tempDir);
    expect(report.members).toHaveLength(0);
    expect(report.common_weaknesses).toHaveLength(0);
    expect(report.best_practices).toHaveLength(0);
  });

  it('.aiwright/team 디렉토리 없으면 빈 report 반환', async () => {
    const noTeamDir = await createTempDir();
    try {
      const report = await syncTeam(noTeamDir);
      expect(report.members).toHaveLength(0);
    } finally {
      await rm(noTeamDir, { recursive: true, force: true });
    }
  });

  it('summary 파일이 있으면 members에 포함된다', async () => {
    await writeSummary(tempDir, 'alice', {
      dna_code: 'AW-R0V8S2',
      total_events: 42,
      avg_score: 0.75,
      strongest: 'specificity',
      weakest: 'constraint_usage',
    });

    const report = await syncTeam(tempDir);
    expect(report.members).toHaveLength(1);
    expect(report.members[0].user_id).toBe('alice');
    expect(report.members[0].total_events).toBe(42);
  });

  it('2명 이상 공유 weakness가 common_weaknesses에 포함된다', async () => {
    await writeSummary(tempDir, 'alice', {
      total_events: 30,
      weakness_ids: ['W001', 'W004'],
    });
    await writeSummary(tempDir, 'bob', {
      total_events: 20,
      weakness_ids: ['W001', 'W005'],
    });

    const report = await syncTeam(tempDir);
    expect(report.common_weaknesses).toContain('W001');
    expect(report.common_weaknesses).not.toContain('W004');
    expect(report.common_weaknesses).not.toContain('W005');
  });

  it('avg_score 가장 높은 멤버의 특징이 best_practices에 포함된다', async () => {
    await writeSummary(tempDir, 'alice', {
      total_events: 30,
      avg_score: 0.9,
      strongest: 'imperative_clarity',
      dna_code: 'AW-I9R8S7',
    });
    await writeSummary(tempDir, 'bob', {
      total_events: 20,
      avg_score: 0.5,
      strongest: 'verbosity',
    });

    const report = await syncTeam(tempDir);
    expect(report.best_practices.some((bp) => bp.includes('imperative_clarity'))).toBe(true);
  });

  it('여러 summary 파일 모두 members에 포함된다', async () => {
    await writeSummary(tempDir, 'alice', { total_events: 10 });
    await writeSummary(tempDir, 'bob', { total_events: 20 });
    await writeSummary(tempDir, 'charlie', { total_events: 30 });

    const report = await syncTeam(tempDir);
    expect(report.members).toHaveLength(3);
  });
});

describe('renderTeamDashboard', () => {
  it('members 없으면 안내 메시지 출력', () => {
    const report: TeamReport = { members: [], common_weaknesses: [], best_practices: [] };
    const output = renderTeamDashboard(report);
    expect(output).toContain('No team members found');
  });

  it('members 있으면 테이블 테두리가 포함된다', () => {
    const report: TeamReport = {
      members: [
        { user_id: 'alice', total_events: 42, dna_code: 'AW-R0V8S2', strongest: 'Review', weakest: 'Arch.' },
        { user_id: 'bob', total_events: 28, dna_code: 'AW-S7I9X4', strongest: 'Debug', weakest: 'Context' },
      ],
      common_weaknesses: ['constraint_usage'],
      best_practices: [],
    };
    const output = renderTeamDashboard(report);
    expect(output).toContain('┌');
    expect(output).toContain('┐');
    expect(output).toContain('└');
    expect(output).toContain('┘');
  });

  it('members의 user_id가 출력에 포함된다', () => {
    const report: TeamReport = {
      members: [
        { user_id: 'alice', total_events: 42 },
      ],
      common_weaknesses: [],
      best_practices: [],
    };
    const output = renderTeamDashboard(report);
    expect(output).toContain('alice');
  });

  it('헤더 컬럼이 포함된다', () => {
    const report: TeamReport = {
      members: [{ user_id: 'alice', total_events: 5 }],
      common_weaknesses: [],
      best_practices: [],
    };
    const output = renderTeamDashboard(report);
    expect(output).toContain('Member');
    expect(output).toContain('DNA');
    expect(output).toContain('Strength');
    expect(output).toContain('Weakness');
    expect(output).toContain('Events');
  });

  it('common_weakness가 있으면 출력에 포함된다', () => {
    const report: TeamReport = {
      members: [{ user_id: 'alice', total_events: 10 }],
      common_weaknesses: ['W001', 'W004'],
      best_practices: [],
    };
    const output = renderTeamDashboard(report);
    expect(output).toContain('Common gap:');
    expect(output).toContain('W001');
  });

  it('best_practices가 있으면 출력에 포함된다', () => {
    const report: TeamReport = {
      members: [{ user_id: 'alice', total_events: 10 }],
      common_weaknesses: [],
      best_practices: ['High specificity (top performer: alice)'],
    };
    const output = renderTeamDashboard(report);
    expect(output).toContain('Best practices:');
    expect(output).toContain('High specificity');
  });
});
