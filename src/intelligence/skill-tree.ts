import { type PromptStyle, type BehaviorProfile } from '../schema/user-profile.js';

export interface SkillNode {
  name: string;
  level: number; // 0=locked, 1=beginner, 2=intermediate, 3=master
  score: number; // 0~1
  children?: SkillNode[];
  unlock_hint?: string;
}

function scoreToLevel(score: number): number {
  if (score >= 0.7) return 3;
  if (score >= 0.4) return 2;
  if (score > 0) return 1;
  return 0;
}

function unlockHint(name: string): string {
  const hints: Record<string, string> = {
    'System Role': 'add a system role in your recipe',
    'Context': 'include context slot in your prompts',
    'Constraint': 'add constraint fragment to your recipe',
    'Specificity': 'fill all {{variables}} in your templates',
    'Imperative Clarity': 'start instructions with imperative verbs (Do, Return, Always)',
    'Examples': 'add few-shot examples with example slot',
    'First-Turn Rate': 'track outcomes with `aiwright score`',
    'Delegation Lv3+': 'use both constraint and example slots consistently',
    'Token Efficiency': 'avoid repeating instructions in your prompts',
  };
  return hints[name] ?? `improve ${name.toLowerCase()}`;
}

/**
 * PromptStyle + BehaviorProfile 기반 스킬 트리 빌드
 */
export function buildSkillTree(style: PromptStyle, behavior?: BehaviorProfile): SkillNode {
  // Structure 가지
  const systemRoleScore = style.verbosity; // verbosity가 높으면 system role도 잘 쓴다고 매핑
  const contextScore = style.context_ratio;
  const constraintScore = style.constraint_usage;

  const structureChildren: SkillNode[] = [
    {
      name: 'System Role',
      level: scoreToLevel(systemRoleScore),
      score: systemRoleScore,
      unlock_hint: unlockHint('System Role'),
    },
    {
      name: 'Context',
      level: scoreToLevel(contextScore),
      score: contextScore,
      unlock_hint: unlockHint('Context'),
    },
    {
      name: 'Constraint',
      level: scoreToLevel(constraintScore),
      score: constraintScore,
      unlock_hint: unlockHint('Constraint'),
    },
  ];

  // Precision 가지
  const specificityScore = style.specificity;
  const imperativeScore = style.imperative_clarity;
  const exampleScore = style.example_usage;

  const precisionChildren: SkillNode[] = [
    {
      name: 'Specificity',
      level: scoreToLevel(specificityScore),
      score: specificityScore,
      unlock_hint: unlockHint('Specificity'),
    },
    {
      name: 'Imperative Clarity',
      level: scoreToLevel(imperativeScore),
      score: imperativeScore,
      unlock_hint: unlockHint('Imperative Clarity'),
    },
    {
      name: 'Examples',
      level: scoreToLevel(exampleScore),
      score: exampleScore,
      unlock_hint: unlockHint('Examples'),
    },
  ];

  // Efficiency 가지 (behavior 있을 때만)
  let efficiencyChildren: SkillNode[] | undefined;
  if (behavior) {
    // delegation_maturity: 1-4 → 0-1 정규화 ((level-1)/3)
    const delegationScore = (behavior.delegation_maturity - 1) / 3;
    // context_obesity는 낮을수록 좋음 → 1 - obesity
    const tokenEffScore = 1 - behavior.context_obesity;

    efficiencyChildren = [
      {
        name: 'First-Turn Rate',
        level: scoreToLevel(behavior.ftrr),
        score: behavior.ftrr,
        unlock_hint: unlockHint('First-Turn Rate'),
      },
      {
        name: 'Delegation Lv3+',
        level: scoreToLevel(delegationScore),
        score: delegationScore,
        unlock_hint: unlockHint('Delegation Lv3+'),
      },
      {
        name: 'Token Efficiency',
        level: scoreToLevel(tokenEffScore),
        score: tokenEffScore,
        unlock_hint: unlockHint('Token Efficiency'),
      },
    ];
  }

  const avgScore = (nodes: SkillNode[]) =>
    nodes.reduce((s, n) => s + n.score, 0) / nodes.length;

  const branches: SkillNode[] = [
    {
      name: 'Structure',
      level: scoreToLevel(avgScore(structureChildren)),
      score: avgScore(structureChildren),
      children: structureChildren,
    },
    {
      name: 'Precision',
      level: scoreToLevel(avgScore(precisionChildren)),
      score: avgScore(precisionChildren),
      children: precisionChildren,
    },
  ];

  if (efficiencyChildren) {
    branches.push({
      name: 'Efficiency',
      level: scoreToLevel(avgScore(efficiencyChildren)),
      score: avgScore(efficiencyChildren),
      children: efficiencyChildren,
    });
  }

  const rootScore = avgScore(branches);

  return {
    name: 'AI Craft',
    level: scoreToLevel(rootScore),
    score: rootScore,
    children: branches,
  };
}

function levelStars(level: number): string {
  const filled = '★'.repeat(level);
  const empty = '☆'.repeat(3 - level);
  return filled + empty;
}

function levelBar(score: number): string {
  const filled = Math.round(Math.min(1, Math.max(0, score)) * 3);
  const empty = 3 - filled;
  return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

/**
 * ASCII 스킬 트리 렌더링
 */
export function renderSkillTree(root: SkillNode): string {
  const lines: string[] = [];

  lines.push(root.name);

  const branches = root.children ?? [];
  for (let bi = 0; bi < branches.length; bi++) {
    const branch = branches[bi];
    const isLastBranch = bi === branches.length - 1;
    const branchPrefix = isLastBranch ? '└── ' : '├── ';
    const childPrefix = isLastBranch ? '    ' : '│   ';

    lines.push(`${branchPrefix}${branch.name}`);

    const leafs = branch.children ?? [];
    for (let li = 0; li < leafs.length; li++) {
      const leaf = leafs[li];
      const isLastLeaf = li === leafs.length - 1;
      const leafBranch = isLastLeaf ? '└── ' : '├── ';
      const bar = levelBar(leaf.score);
      const stars = levelStars(leaf.level);

      let line = `${childPrefix}${leafBranch}${bar} ${leaf.name.padEnd(22)} ${stars}`;

      if (leaf.level === 0 && leaf.unlock_hint) {
        line += `  ← UNLOCK: ${leaf.unlock_hint}`;
      }

      lines.push(line);
    }
  }

  return lines.join('\n');
}
