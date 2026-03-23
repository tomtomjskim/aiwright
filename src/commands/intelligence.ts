import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'node:readline';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadEvents, loadProfile, saveProfile } from '../intelligence/storage.js';
import { computeStyle, generateDnaCode, aggregateDomains } from '../intelligence/profiler.js';
import { diagnoseWeaknesses } from '../intelligence/diagnose.js';
import { computeBehavior } from '../intelligence/behavior.js';
import { computeGrowth } from '../intelligence/growth.js';
import { buildSkillTree, renderSkillTree } from '../intelligence/skill-tree.js';
import { generateKata } from '../intelligence/kata.js';
import { exportProfile, syncTeam, renderTeamDashboard } from '../intelligence/team.js';
import type { PromptStyle, Weakness, DomainStats, BehaviorProfile, GrowthSnapshot } from '../schema/user-profile.js';

// ---- 유틸 ----

function progressBar(value: number, width = 10): string {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * width);
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}

function styleLabel(value: number): string {
  if (value >= 0.6) return chalk.green('good');
  if (value >= 0.3) return chalk.yellow('WARN');
  return chalk.red('HIGH');
}

function severityLabel(s: 'HIGH' | 'WARN' | 'INFO'): string {
  switch (s) {
    case 'HIGH': return chalk.red('[HIGH]');
    case 'WARN': return chalk.yellow('[WARN]');
    case 'INFO': return chalk.dim('[INFO]');
  }
}

function printStyleProfile(style: PromptStyle): void {
  console.log(chalk.bold('\nPrompt Style Profile'));
  const axes: Array<[string, number]> = [
    ['verbosity', style.verbosity],
    ['specificity', style.specificity],
    ['context_ratio', style.context_ratio],
    ['constraint_usage', style.constraint_usage],
    ['example_usage', style.example_usage],
    ['imperative_clarity', style.imperative_clarity],
  ];
  for (const [name, value] of axes) {
    console.log(`  ${name.padEnd(20)} ${progressBar(value)}  ${value.toFixed(2)}  ${styleLabel(value)}`);
  }
}

function printWeaknesses(weaknesses: Weakness[]): void {
  console.log(chalk.bold('\nWeaknesses'));
  if (weaknesses.length === 0) {
    console.log(chalk.dim('  No significant weaknesses detected.'));
    return;
  }
  for (const w of weaknesses) {
    console.log(`  ${severityLabel(w.severity)} ${w.id} = ${chalk.dim(w.message)}`);
    console.log(`    ${w.suggestion}`);
    if (w.fragment) console.log(chalk.dim(`    → Fragment: ${w.fragment}`));
  }
}

function printBehavior(behavior: BehaviorProfile): void {
  console.log(chalk.bold('\nBehavior Profile'));
  const maturityLabels = ['', 'Lv1 Basic', 'Lv2 Structured', 'Lv3 Advanced', 'Lv4 Expert'];
  console.log(`  ${'ftrr'.padEnd(20)} ${progressBar(behavior.ftrr)}  ${behavior.ftrr.toFixed(2)}  ${styleLabel(behavior.ftrr)}`);
  console.log(`  ${'context_obesity'.padEnd(20)} ${progressBar(behavior.context_obesity)}  ${behavior.context_obesity.toFixed(2)}  ${behavior.context_obesity > 0.6 ? chalk.red('HIGH') : chalk.green('good')}`);
  console.log(`  ${'delegation_maturity'.padEnd(20)} ${chalk.cyan(maturityLabels[behavior.delegation_maturity] ?? `Lv${behavior.delegation_maturity}`)}`);
}

function printGrowth(growth: GrowthSnapshot[]): void {
  if (growth.length === 0) return;
  console.log(chalk.bold('\nGrowth Timeline'));
  for (const snap of growth) {
    const bar = progressBar(snap.overall_score, 8);
    console.log(`  ${snap.period}  ${bar}  avg: ${snap.overall_score.toFixed(2)}  (${chalk.dim(String(snap.event_count) + ' events')})`);
  }
}

function printDomains(domains: DomainStats[]): void {
  if (domains.length === 0) return;
  console.log(chalk.bold('\nDomain Performance'));
  const weakest = domains.reduce((min, d) => (d.avg_score < min.avg_score ? d : min), domains[0]);
  for (const d of domains) {
    const isWeakest = d.domain === weakest.domain && domains.length > 1;
    const suffix = isWeakest ? chalk.dim('  ← weakest') : '';
    console.log(`  ${d.domain.padEnd(18)} avg: ${d.avg_score.toFixed(2)}  ${chalk.dim(`(${d.total_events} events)`)}${suffix}`);
  }
}

// ---- analyze ----

async function runAnalyze(): Promise<void> {
  const events = await loadEvents();

  console.log(chalk.bold('Intelligence Analysis'));
  console.log(chalk.dim('═'.repeat(51)));

  if (events.length === 0) {
    console.log(chalk.yellow('  No events recorded yet.'));
    console.log(chalk.dim('  Use `aiwright apply` and `aiwright score` to collect data.'));
    return;
  }

  const applyCount = events.filter((e) => e.event_type === 'apply').length;
  const scoreCount = events.filter((e) => e.event_type === 'score').length;

  const style = computeStyle(events);
  const dnaCode = generateDnaCode(style);
  const weaknesses = diagnoseWeaknesses(style);
  const domains = aggregateDomains(events);
  const behavior = computeBehavior(events);
  const growth = computeGrowth(events);

  console.log(`Events: ${chalk.cyan(String(applyCount))} apply, ${chalk.cyan(String(scoreCount))} score`);
  console.log(`DNA: ${chalk.bold.cyan(dnaCode)}`);

  printStyleProfile(style);
  printBehavior(behavior);
  printWeaknesses(weaknesses);
  printDomains(domains);
  printGrowth(growth);

  // 기존 profile에서 adaptive 설정 보존
  const existingProfile = await loadProfile().catch(() => null);

  await saveProfile({
    version: '1',
    user_id: 'default',
    updated_at: new Date().toISOString(),
    style,
    dna_code: dnaCode,
    weaknesses,
    domains,
    adaptive: existingProfile?.adaptive ?? { enabled: false, rules: [] },
    behavior,
    growth,
    total_events: events.length,
  });

  console.log(chalk.dim('\n  Profile saved to ~/.aiwright/profile.yaml'));
}

// ---- profile ----

async function runProfile(): Promise<void> {
  const profile = await loadProfile();
  if (!profile) {
    console.log(chalk.yellow('No profile found.'));
    console.log(chalk.dim('  Run `aiwright intelligence analyze` first'));
    return;
  }

  console.log(chalk.bold('User Intelligence Profile'));
  console.log(chalk.dim('═'.repeat(51)));
  console.log(`Updated: ${chalk.dim(new Date(profile.updated_at).toLocaleString())}`);
  console.log(`Events: ${chalk.cyan(String(profile.total_events))}`);
  if (profile.dna_code) console.log(`DNA: ${chalk.bold.cyan(profile.dna_code)}`);

  printStyleProfile(profile.style);
  printWeaknesses(profile.weaknesses);
  printDomains(profile.domains);
}

// ---- skill-tree ----

async function runSkillTree(): Promise<void> {
  const profile = await loadProfile();
  if (!profile) {
    console.log(chalk.yellow('No profile found.'));
    console.log(chalk.dim('  Run `aiwright intelligence analyze` first'));
    return;
  }

  const root = buildSkillTree(profile.style, profile.behavior);
  console.log(chalk.bold('Skill Tree'));
  console.log(chalk.dim('═'.repeat(51)));
  console.log(renderSkillTree(root));
}

// ---- kata ----

async function runKata(): Promise<void> {
  const profile = await loadProfile();
  if (!profile) {
    console.log(chalk.yellow('No profile found.'));
    console.log(chalk.dim('  Run `aiwright intelligence analyze` first'));
    return;
  }

  const kata = generateKata(profile.weaknesses, profile.style);
  console.log(chalk.bold("Today's Kata Challenge"));
  console.log(chalk.dim('═'.repeat(51)));
  console.log(`${chalk.bold(kata.title)}  ${chalk.dim('[' + kata.difficulty + ']')}  ${chalk.cyan(kata.target_skill)}`);
  console.log(chalk.dim(kata.description));
  console.log('');
  console.log(chalk.bold('Task:'));
  console.log(`  ${kata.task}`);
  console.log('');
  console.log(chalk.bold('Success Criteria:'));
  for (const criterion of kata.success_criteria) {
    console.log(`  ${chalk.green('✓')} ${criterion}`);
  }
  if (kata.hint) {
    console.log('');
    console.log(chalk.dim(`Hint: ${kata.hint}`));
  }
}

// ---- export ----

async function runExport(projectDir: string): Promise<void> {
  try {
    const filePath = await exportProfile(projectDir);
    console.log(chalk.green('✔') + ' Profile exported for team sharing');
    console.log(chalk.dim(`  → ${filePath}`));
    console.log(chalk.dim('  Commit .aiwright/team/ to your repository to share with teammates.'));
  } catch (err) {
    console.error(chalk.red(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`));
    process.exit(1);
  }
}

// ---- team-sync ----

async function runTeamSync(projectDir: string): Promise<void> {
  console.log(chalk.bold('Team Sync'));
  console.log(chalk.dim('Scanning .aiwright/team/*.summary.yaml...'));

  const report = await syncTeam(projectDir);

  if (report.members.length === 0) {
    console.log(chalk.yellow('  No team profiles found.'));
    console.log(chalk.dim('  Run `aiwright intelligence export` on each member\'s machine,'));
    console.log(chalk.dim('  then commit .aiwright/team/ to the shared repository.'));
    return;
  }

  console.log(chalk.green(`  Found ${report.members.length} team member(s)`));
  console.log(renderTeamDashboard(report));
}

// ---- team ----

async function runTeam(projectDir: string): Promise<void> {
  const report = await syncTeam(projectDir);
  console.log(chalk.bold('Team Dashboard'));
  console.log(chalk.dim('═'.repeat(51)));
  console.log(renderTeamDashboard(report));
}

// ---- reset ----

async function runReset(force: boolean): Promise<void> {
  if (!force) {
    const answer = await new Promise<string>((resolve) => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(chalk.yellow('Delete all intelligence data? (y/N) '), (ans) => { rl.close(); resolve(ans); });
    });
    if (answer.trim().toLowerCase() !== 'y') {
      console.log(chalk.dim('  Aborted.'));
      return;
    }
  }

  const baseDir = path.join(os.homedir(), '.aiwright');
  await rm(path.join(baseDir, 'events'), { recursive: true, force: true });
  await rm(path.join(baseDir, 'profile.yaml'), { force: true });
  console.log(chalk.green('✔') + ' Intelligence data reset.');
}

// ---- register ----

export function registerIntelligenceCommand(program: Command): void {
  program
    .command('intelligence <subcommand>')
    .description('User intelligence: analyze, profile, skill-tree, kata, export, team-sync, team, reset')
    .option('--force', 'Skip confirmation (reset)')
    .action(async (subcommand: string, opts: { force?: boolean }) => {
      const projectDir = process.cwd();
      try {
        switch (subcommand) {
          case 'analyze': await runAnalyze(); break;
          case 'profile': await runProfile(); break;
          case 'skill-tree': await runSkillTree(); break;
          case 'kata': await runKata(); break;
          case 'export': await runExport(projectDir); break;
          case 'team-sync': await runTeamSync(projectDir); break;
          case 'team': await runTeam(projectDir); break;
          case 'reset': await runReset(opts.force ?? false); break;
          default:
            console.error(chalk.red(`Unknown subcommand "${subcommand}". Available: analyze, profile, skill-tree, kata, export, team-sync, team, reset`));
            process.exit(1);
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}
