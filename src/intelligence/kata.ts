import { type PromptStyle, type Weakness } from '../schema/user-profile.js';

export interface Kata {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  target_skill: string; // skill tree node name
  task: string;
  success_criteria: string[];
  hint?: string;
}

/** 내장 Kata 템플릿 10개 이상 */
const KATA_TEMPLATES: Kata[] = [
  // constraint_usage 관련
  {
    id: 'kata-001',
    title: 'The Three Constraints',
    description: 'constraint 슬롯을 활용한 코드 리뷰 프롬프트 작성',
    difficulty: 'easy',
    target_skill: 'Constraint',
    task: '3개의 constraint를 사용하여 코드 리뷰 프롬프트를 작성하세요. 예: "하지 말아야 할 것", 출력 형식 제한, 언어 제한.',
    success_criteria: [
      'constraint slot이 존재한다',
      '최소 3개의 명시적 제약이 있다',
      'AI가 무엇을 하면 안 되는지 명확히 기술했다',
    ],
    hint: '`[[constraint]]` 슬롯에 "Do not suggest rewrites for working code", "Return only the list of issues", "Do not add new features" 같은 제약을 추가하세요.',
  },
  {
    id: 'kata-002',
    title: 'Constraint Boundary',
    description: 'API 설계 시 constraint로 범위를 제한하는 프롬프트 작성',
    difficulty: 'medium',
    target_skill: 'Constraint',
    task: 'REST API 설계 프롬프트에 constraint 슬롯을 추가하여 응답 범위를 명확히 제한하세요.',
    success_criteria: [
      'constraint slot이 포함되어 있다',
      '출력 형식이 명시되어 있다',
      'out-of-scope 항목이 명시되어 있다',
    ],
    hint: '"Only design endpoints for the given domain", "Return OpenAPI 3.0 YAML", "Do not include authentication endpoints" 같은 제약을 사용하세요.',
  },
  // specificity 관련
  {
    id: 'kata-003',
    title: 'Fill the Blanks',
    description: '모든 변수를 채운 상태로 디버깅 프롬프트를 작성하세요',
    difficulty: 'easy',
    target_skill: 'Specificity',
    task: '에러 디버깅 프롬프트를 작성하되, 모든 {{변수}}를 실제 값으로 채워 넣으세요. 언어, 에러 메시지, 컨텍스트가 모두 구체적이어야 합니다.',
    success_criteria: [
      '채워지지 않은 {{변수}}가 없다',
      '구체적인 언어/프레임워크가 명시되어 있다',
      '실제 에러 메시지 또는 증상이 포함되어 있다',
    ],
    hint: '{{language}}, {{error_message}}, {{file_path}} 같은 변수는 실제 값으로 교체하세요.',
  },
  {
    id: 'kata-004',
    title: 'Zero Ambiguity',
    description: '모호한 요청을 제거하고 구체적인 프롬프트로 재작성하기',
    difficulty: 'medium',
    target_skill: 'Specificity',
    task: '"코드를 개선해줘" 같은 모호한 프롬프트를 구체적으로 재작성하세요. 대상, 목표, 성공 기준을 모두 명시하세요.',
    success_criteria: [
      '대상 코드/기능이 명확히 지정되어 있다',
      '개선 방향이 구체적으로 기술되어 있다',
      '기대 결과물 형식이 명시되어 있다',
    ],
    hint: '누가, 무엇을, 어떻게, 어떤 형식으로를 모두 명시하세요.',
  },
  // example_usage 관련
  {
    id: 'kata-005',
    title: 'Few-Shot Architect',
    description: 'Few-shot 예시 2개를 포함한 API 설계 프롬프트 작성',
    difficulty: 'medium',
    target_skill: 'Examples',
    task: 'Few-shot 예시 2개를 포함한 API 설계 프롬프트를 작성하세요. 예시는 입력-출력 쌍이어야 합니다.',
    success_criteria: [
      'example slot 또는 예시 섹션이 존재한다',
      '최소 2개의 입력-출력 예시가 있다',
      '예시가 실제 사용 케이스를 반영한다',
    ],
    hint: '`Input: [요청 예시]\nOutput: [기대 결과 예시]` 형태로 2개 이상 추가하세요.',
  },
  {
    id: 'kata-006',
    title: 'Pattern Matcher',
    description: '단위 테스트 생성 프롬프트에 예시 패턴 추가',
    difficulty: 'hard',
    target_skill: 'Examples',
    task: '단위 테스트 생성 프롬프트에 기대하는 테스트 구조 예시를 2-3개 추가하세요. 각 예시는 다른 테스트 케이스 유형을 보여야 합니다.',
    success_criteria: [
      '정상 경로 예시가 있다',
      '에러/경계 케이스 예시가 있다',
      'describe/it 구조가 예시에 반영되어 있다',
    ],
    hint: 'Happy path, error case, edge case 각각에 대한 예시 테스트를 포함하세요.',
  },
  // imperative_clarity 관련
  {
    id: 'kata-007',
    title: 'Command Mode',
    description: '모든 문장을 명령형으로 시작하는 테스트 작성 프롬프트',
    difficulty: 'easy',
    target_skill: 'Imperative Clarity',
    task: '테스트 작성 프롬프트를 작성하되, 모든 지시 문장이 명령형 동사(Write, Return, Include, Do not, Always, Never)로 시작하도록 하세요.',
    success_criteria: [
      '모든 지시 문장이 명령형으로 시작한다',
      '요청/청유 형태(~해주세요, please, could you)가 없다',
      '최소 3개의 명령형 지시가 있다',
    ],
    hint: '"Please write..." 대신 "Write...", "Can you return..." 대신 "Return..."을 사용하세요.',
  },
  {
    id: 'kata-008',
    title: 'No Please Zone',
    description: '기존 프롬프트에서 soft directive를 제거하고 명령형으로 재작성',
    difficulty: 'medium',
    target_skill: 'Imperative Clarity',
    task: '"~해주세요", "부탁입니다", "가능하면", "please" 같은 soft directive가 없는 코드 리팩토링 프롬프트를 작성하세요.',
    success_criteria: [
      'soft directive가 전혀 없다',
      '모든 요청이 직접 명령 형태다',
      '명확한 기대 결과가 명시되어 있다',
    ],
  },
  // context_ratio 관련
  {
    id: 'kata-009',
    title: 'Context First',
    description: '충분한 배경 컨텍스트를 포함한 아키텍처 설계 프롬프트',
    difficulty: 'medium',
    target_skill: 'Context',
    task: '마이크로서비스 아키텍처 설계 프롬프트를 작성하되, 현재 시스템 상황, 팀 규모, 기술 스택 등 충분한 컨텍스트를 포함하세요.',
    success_criteria: [
      'context slot 또는 배경 섹션이 있다',
      '현재 상황이 구체적으로 기술되어 있다',
      '제약 조건(규모, 예산, 기간 등)이 명시되어 있다',
    ],
    hint: 'system slot에 현재 아키텍처 상황을, context slot에 이전 결정 사항과 제약을 추가하세요.',
  },
  // System Role 관련
  {
    id: 'kata-010',
    title: 'Role Definition',
    description: '명확한 시스템 역할(persona)을 정의한 코드 리뷰 프롬프트',
    difficulty: 'easy',
    target_skill: 'System Role',
    task: 'system slot에 명확한 AI 역할(시니어 개발자, 보안 전문가 등)을 정의하고, 그에 맞는 코드 리뷰 프롬프트를 작성하세요.',
    success_criteria: [
      'system slot에 구체적인 역할이 정의되어 있다',
      '역할과 작업 내용이 일치한다',
      '역할에 맞는 관점이 반영되어 있다',
    ],
    hint: '"You are a senior TypeScript engineer with 10+ years of experience, specializing in Node.js backend systems."',
  },
  // 고급 챌린지 (약점 없을 때)
  {
    id: 'kata-011',
    title: 'Meta-Prompt Architect',
    description: '다른 프롬프트를 생성하는 메타 프롬프트 작성',
    difficulty: 'hard',
    target_skill: 'AI Craft',
    task: '특정 도메인(코드 리뷰, 문서 작성, 디버깅)의 프롬프트 템플릿을 생성하는 메타 프롬프트를 작성하세요.',
    success_criteria: [
      '생성될 프롬프트의 구조가 명시되어 있다',
      '변수 위치({{...}})가 적절히 포함되어 있다',
      'constraint와 example이 모두 포함되어 있다',
    ],
    hint: '출력 형식을 YAML이나 Markdown으로 지정하고, 각 섹션의 가이드라인을 명시하세요.',
  },
  {
    id: 'kata-012',
    title: 'Chain of Thought',
    description: '단계별 추론을 유도하는 복잡한 분석 프롬프트',
    difficulty: 'hard',
    target_skill: 'AI Craft',
    task: 'AI가 단계별로 추론하도록 유도하는 성능 분석 프롬프트를 작성하세요. "Think step by step" 방식을 활용하세요.',
    success_criteria: [
      '명시적인 추론 단계가 있다',
      '각 단계의 출력 형식이 정의되어 있다',
      '최종 결론 형식이 명시되어 있다',
    ],
  },
  {
    id: 'kata-013',
    title: 'Contradiction Detector',
    description: '모순되는 제약 없이 복잡한 조건을 처리하는 프롬프트',
    difficulty: 'hard',
    target_skill: 'Constraint',
    task: '"always"와 "never"를 동일 대상에 사용하지 않으면서, 복잡한 조건을 처리하는 데이터 변환 프롬프트를 작성하세요.',
    success_criteria: [
      '모순되는 제약이 없다',
      '복잡한 조건이 논리적으로 구조화되어 있다',
      '예외 케이스 처리가 명시되어 있다',
    ],
    hint: '"always"와 "never"의 대상이 겹치지 않는지 검토하세요.',
  },
];

/** 약점 ID → target_skill 매핑 */
const WEAKNESS_TO_SKILL: Record<string, string[]> = {
  W001: ['Constraint'], // constraint_usage 낮음
  W002: ['Specificity'], // specificity 낮음
  W003: ['System Role', 'Context'], // verbosity 낮음
  W004: ['Examples'], // example_usage 없음
  W005: ['Imperative Clarity'], // imperative_clarity 낮음
};

/**
 * 약점 기반 맞춤 일일 Kata 생성
 * 약점이 없으면 고급 랜덤 챌린지 반환
 */
export function generateKata(weaknesses: Weakness[], style: PromptStyle): Kata {
  // 약점 → 타겟 스킬 수집
  const targetSkills: string[] = [];
  for (const weakness of weaknesses) {
    const skills = WEAKNESS_TO_SKILL[weakness.id] ?? [];
    targetSkills.push(...skills);
  }

  // 추가적으로 style 값이 0인 항목도 타겟으로 추가
  if (style.constraint_usage === 0) targetSkills.push('Constraint');
  if (style.example_usage === 0) targetSkills.push('Examples');
  if (style.imperative_clarity < 0.2) targetSkills.push('Imperative Clarity');

  // 중복 제거
  const uniqueTargets = [...new Set(targetSkills)];

  if (uniqueTargets.length > 0) {
    // 첫 번째 타겟 스킬에 맞는 Kata 중 easy/medium 우선 선택
    const primarySkill = uniqueTargets[0];
    const matching = KATA_TEMPLATES.filter(
      (k) => k.target_skill === primarySkill && k.difficulty !== 'hard',
    );
    if (matching.length > 0) {
      // deterministic: 날짜 기반 선택 (같은 날 같은 kata)
      const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
      return matching[dayIndex % matching.length];
    }

    // easy/medium 없으면 전체에서 선택
    const allMatching = KATA_TEMPLATES.filter((k) => k.target_skill === primarySkill);
    if (allMatching.length > 0) {
      const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
      return allMatching[dayIndex % allMatching.length];
    }
  }

  // 약점 없음 → 고급 랜덤 챌린지
  const hardKatas = KATA_TEMPLATES.filter((k) => k.difficulty === 'hard');
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return hardKatas[dayIndex % hardKatas.length];
}
