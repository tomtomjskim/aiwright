import { Command } from 'commander';
import chalk from 'chalk';
import readline from 'node:readline';
import { rm } from 'node:fs/promises';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import yaml from 'js-yaml';
import { loadEvents, loadProfile, saveProfile } from '../intelligence/storage.js';
import { detectDrift } from '../intelligence/drift.js';
import { judgePrompt } from '../intelligence/llm-judge.js';
import { computeStyle, generateDnaCode, aggregateDomains } from '../intelligence/profiler.js';
import { diagnoseWeaknesses } from '../intelligence/diagnose.js';
import { computeBehavior } from '../intelligence/behavior.js';
import { computeGrowth } from '../intelligence/growth.js';
import { buildSkillTree, renderSkillTree } from '../intelligence/skill-tree.js';
import { generateKata } from '../intelligence/kata.js';
import { exportProfile, syncTeam, renderTeamDashboard } from '../intelligence/team.js';
import { optimizeCombination } from '../intelligence/optimizer.js';
import { evolveFragments } from '../intelligence/evolution.js';
import { resolveAllFragments, resolveFragment } from '../core/resolver.js';
import { loadFragment } from '../core/loader.js';
import { ProjectConfigSchema } from '../schema/config.js';
import { fileExists } from '../utils/fs.js';
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

// ---- drift ----

async function runDrift(recipe: string): Promise<void> {
  const events = await loadEvents();

  console.log(chalk.bold(`Drift Detection: ${recipe}`));
  console.log(chalk.dim('═'.repeat(39)));

  if (events.length === 0) {
    console.log(chalk.yellow('  No events recorded yet.'));
    console.log(chalk.dim('  Use `aiwright apply` and `aiwright score` to collect data.'));
    return;
  }

  const report = detectDrift(events, recipe);

  const levelIcon: Record<string, string> = {
    none: chalk.green('✓ OK'),
    warning: chalk.yellow('⚠ WARNING'),
    adjustment: chalk.red('✖ ADJUSTMENT NEEDED'),
    deactivation: chalk.red('✖✖ DEACTIVATION SUGGESTED'),
  };

  const trendIcon: Record<string, string> = {
    improving: chalk.green('↗'),
    stable: chalk.dim('→'),
    declining: chalk.red('↘'),
  };

  console.log(`Status: ${levelIcon[report.level] ?? report.level}`);

  if (report.level !== 'none') {
    console.log(`  ${report.message}`);
    console.log(`  Recent avg: ${report.avg_recent.toFixed(2)}  Previous avg: ${report.avg_previous.toFixed(2)}`);
    console.log(`  Trend: ${report.trend} ${trendIcon[report.trend] ?? ''}`);
  } else {
    if (report.avg_recent > 0) {
      console.log(`  Recent avg: ${report.avg_recent.toFixed(2)}  Trend: ${report.trend} ${trendIcon[report.trend] ?? ''}`);
    } else {
      console.log(chalk.dim('  Not enough scored events to calculate drift.'));
    }
  }

  if (report.suggestion) {
    console.log('');
    console.log(chalk.bold('Suggestion:'));
    for (const line of report.suggestion.split('\n')) {
      console.log(`  ${line}`);
    }
  }
}

// ---- judge ----

async function runJudge(recipe: string): Promise<void> {
  const events = await loadEvents();

  console.log(chalk.bold(`LLM-as-Judge: ${recipe}`));
  console.log(chalk.dim('═'.repeat(39)));

  // recipe에 해당하는 가장 최근 apply 이벤트에서 합성된 프롬프트 텍스트 구성
  // 이벤트에는 프롬프트 원문이 저장되지 않으므로 메트릭 기반 시뮬레이션 텍스트 생성
  const recipeEvents = events
    .filter((e) => e.recipe === recipe && e.event_type === 'apply')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  let simulatedText: string;
  if (recipeEvents.length > 0) {
    const latest = recipeEvents[0];
    simulatedText = buildSimulatedPrompt(latest.prompt_metrics);
  } else {
    // 이벤트가 없어도 최소 텍스트로 judge 실행
    simulatedText = `[system]\nYou are an AI assistant.\n[instruction]\nComplete the task.`;
  }

  const result = await judgePrompt(simulatedText);

  const scoreColor = result.score >= 0.8 ? chalk.green : result.score >= 0.6 ? chalk.yellow : chalk.red;
  console.log(`Score: ${scoreColor(result.score.toFixed(2))}`);
  console.log('');

  if (result.strengths.length > 0) {
    console.log(chalk.bold('Strengths:'));
    for (const s of result.strengths) {
      console.log(`  ${chalk.green('+')} ${s}`);
    }
    console.log('');
  }

  if (result.weaknesses.length > 0) {
    console.log(chalk.bold('Weaknesses:'));
    for (const w of result.weaknesses) {
      console.log(`  ${chalk.red('-')} ${w}`);
    }
    console.log('');
  }

  console.log(chalk.bold('Feedback:'));
  console.log(`  ${result.feedback}`);
  console.log(chalk.dim(`\n  Model: ${result.model}`));
}

/**
 * PromptMetrics 기반으로 시뮬레이션 프롬프트 텍스트 구성
 * (실제 원문 저장 없음 — 메트릭으로 역산)
 */
function buildSimulatedPrompt(
  metrics: import('../schema/usage-event.js').PromptMetrics,
): string {
  const parts: string[] = [];

  parts.push('[system]\nYou are a helpful AI assistant.');

  if (metrics.has_context) {
    parts.push('[context]\nRelevant background information for this task.');
  }

  parts.push('[instruction]\nComplete the assigned task.');

  if (metrics.has_constraint) {
    parts.push('[constraint]\nNever output harmful content. Always follow the specified format.');
  }

  if (metrics.has_example) {
    parts.push('[example]\nInput: example\nOutput: result');
  }

  // 변수 슬롯 추가
  if (metrics.variable_count > 0) {
    const unfilled = metrics.variable_count - metrics.variable_filled;
    if (unfilled > 0) {
      parts.push(`[context]\nTopic: {{topic}}`);
    }
  }

  return parts.join('\n\n');
}

// ---- optimize ----

async function runOptimize(recipeName: string): Promise<void> {
  const projectDir = process.cwd();
  const configPath = path.join(projectDir, 'aiwright.config.yaml');

  console.log(chalk.bold(`Optimization: ${recipeName}`));
  console.log(chalk.dim('═'.repeat(39)));

  // 설정 파일 로드 (없으면 빈 recipe로 진행)
  let recipeFragments: string[] = [];
  if (await fileExists(configPath)) {
    try {
      const rawConfig = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.load(rawConfig);
      const configResult = ProjectConfigSchema.safeParse(parsedConfig);
      if (configResult.success) {
        const recipeEntry = configResult.data.recipes[recipeName];
        if (recipeEntry) {
          recipeFragments = recipeEntry.fragments
            .filter((e) => e.enabled !== false)
            .map((e) => e.fragment);
        }
      }
    } catch {
      // 설정 파일 로드 실패 시 빈 조합으로 진행
    }
  }

  // 사용 가능한 모든 Fragment 로드
  const resolveOpts = { projectDir };
  const allResolved = await resolveAllFragments(resolveOpts);
  const allFragments = await Promise.all(
    allResolved.map((r) => loadFragment(r.path).catch(() => null)),
  ).then((results) => results.filter((f): f is NonNullable<typeof f> => f !== null));

  if (allFragments.length === 0) {
    console.log(chalk.yellow('  No fragments available.'));
    console.log(chalk.dim('  Run `aiwright add` or create fragments in .aiwright/fragments/'));
    return;
  }

  const availableNames = allFragments.map((f) => f.meta.name);

  const result = optimizeCombination(allFragments, {
    available_fragments: availableNames,
    current_recipe_fragments: recipeFragments,
    max_iterations: 20,
    target_metric: 'overall',
  });

  const improvementPct = (result.improvement * 100).toFixed(1);
  const improvementStr =
    result.improvement > 0
      ? chalk.green(`+${improvementPct}%`)
      : result.improvement < 0
        ? chalk.red(`${improvementPct}%`)
        : chalk.dim('no change');

  console.log(`Iterations: ${chalk.cyan(String(result.iterations))} / 20`);
  console.log(
    `Current score: ${chalk.dim(
      result.history.length > 0 ? result.history[0].score.toFixed(2) : '0.00',
    )}`,
  );
  console.log(`Best score: ${chalk.green(result.best_score.toFixed(2))} (${improvementStr})`);
  console.log('');
  console.log(chalk.bold('Suggested combination:'));

  const currentSet = new Set(recipeFragments);
  const bestSet = new Set(result.best_combination);

  // kept
  for (const name of result.best_combination) {
    if (currentSet.has(name)) {
      console.log(`  ${chalk.dim('+')} ${name.padEnd(35)} ${chalk.dim('(kept)')}`);
    }
  }
  // added
  for (const name of result.best_combination) {
    if (!currentSet.has(name)) {
      const frag = allFragments.find((f) => f.meta.name === name);
      const slot = frag?.meta.slot ?? '';
      console.log(
        `  ${chalk.green('+')} ${chalk.green(name.padEnd(35))} ${chalk.cyan(`(NEW — slot: ${slot})`)}`,
      );
    }
  }
  // removed
  for (const name of recipeFragments) {
    if (!bestSet.has(name)) {
      const frag = allFragments.find((f) => f.meta.name === name);
      const conflictNote = frag?.meta.conflicts_with.length
        ? `conflicts with ${frag.meta.conflicts_with[0]}`
        : 'removed'
      ;
      console.log(`  ${chalk.red('-')} ${chalk.red(name.padEnd(35))} ${chalk.dim(`(${conflictNote})`)}`);
    }
  }

  console.log('');
  console.log(
    chalk.dim(`Apply this? Run: aiwright apply ${recipeName} with updated config`),
  );
}

// ---- evolve ----

async function runEvolve(recipeName: string): Promise<void> {
  const projectDir = process.cwd();
  const configPath = path.join(projectDir, 'aiwright.config.yaml');

  console.log(chalk.bold(`Evolution Suggestions: ${recipeName}`));
  console.log(chalk.dim('═'.repeat(39)));

  // 프로파일 로드
  const profile = await loadProfile().catch(() => null);
  if (!profile) {
    console.log(chalk.yellow('  No profile found.'));
    console.log(chalk.dim('  Run `aiwright intelligence analyze` first'));
    return;
  }

  // Recipe의 Fragment 이름 목록 로드
  let recipeFragments: string[] = [];
  if (await fileExists(configPath)) {
    try {
      const rawConfig = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = yaml.load(rawConfig);
      const configResult = ProjectConfigSchema.safeParse(parsedConfig);
      if (configResult.success) {
        const recipeEntry = configResult.data.recipes[recipeName];
        if (recipeEntry) {
          recipeFragments = recipeEntry.fragments
            .filter((e) => e.enabled !== false)
            .map((e) => e.fragment);
        }
      }
    } catch {
      // fallback
    }
  }

  // Fragment 로드
  const resolveOpts = { projectDir };
  const fragmentFiles = await Promise.all(
    recipeFragments.map(async (name) => {
      try {
        const resolved = await resolveFragment(name, resolveOpts);
        return loadFragment(resolved.path);
      } catch {
        return null;
      }
    }),
  ).then((results) => results.filter((f): f is NonNullable<typeof f> => f !== null));

  if (fragmentFiles.length === 0) {
    console.log(chalk.yellow('  No fragments found for this recipe.'));
    return;
  }

  const weaknesses = diagnoseWeaknesses(profile.style);
  const result = evolveFragments(fragmentFiles, profile.style, weaknesses);

  if (result.evolved_fragments.length === 0) {
    console.log(chalk.dim('  No evolution suggestions — all fragments look good!'));
  } else {
    for (const evo of result.evolved_fragments) {
      console.log('');
      console.log(`${chalk.bold('Fragment:')} ${chalk.cyan(evo.original)}`);
      console.log(`  ${chalk.dim('Type:')} ${chalk.yellow(evo.improvement_type)}`);
      const previewLines = evo.suggestion.split('\n').slice(0, 3);
      for (const line of previewLines) {
        console.log(`  ${chalk.dim('→')} ${line}`);
      }
      if (evo.suggestion.split('\n').length > 3) {
        console.log(chalk.dim(`  ... (${evo.suggestion.split('\n').length - 3} more lines)`));
      }
    }
  }

  console.log('');
  console.log(chalk.bold('Strategy Evolution:'));
  console.log(`  ${chalk.dim('Current:')}   ${result.strategy_evolution.current}`);
  console.log(`  ${chalk.dim('Suggested:')} ${chalk.cyan(result.strategy_evolution.suggested)}`);
}

// ---- register ----

export function registerIntelligenceCommand(program: Command): void {
  program
    .command('intelligence <subcommand> [target]')
    .description('User intelligence: analyze, profile, skill-tree, kata, export, team-sync, team, reset, drift, judge, optimize, evolve')
    .option('--force', 'Skip confirmation (reset)')
    .action(async (subcommand: string, target: string | undefined, opts: { force?: boolean }) => {
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
          case 'drift': await runDrift(target ?? 'default'); break;
          case 'judge': await runJudge(target ?? 'default'); break;
          case 'optimize': await runOptimize(target ?? 'default'); break;
          case 'evolve': await runEvolve(target ?? 'default'); break;
          default:
            console.error(chalk.red(`Unknown subcommand "${subcommand}". Available: analyze, profile, skill-tree, kata, export, team-sync, team, reset, drift, judge, optimize, evolve`));
            process.exit(1);
        }
      } catch (err) {
        console.error(chalk.red(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`));
        process.exit(1);
      }
    });
}
