import { type PromptStyle, type Weakness } from '../schema/user-profile.js';

/**
 * 6축 스타일 기반 약점 진단
 * Phase 2a 5개 룰
 */
export function diagnoseWeaknesses(style: PromptStyle): Weakness[] {
  const weaknesses: Weakness[] = [];

  // W001: constraint_usage < 0.2 → HIGH 할루시네이션 위험
  if (style.constraint_usage < 0.2) {
    weaknesses.push({
      id: 'W001',
      severity: 'HIGH',
      message: '할루시네이션 위험: 제약 조건(constraint slot) 사용률이 낮습니다.',
      suggestion: 'constraint slot에 "하지 말아야 할 것", 출력 형식 제한 등을 명시하세요.',
      fragment: 'constraint',
    });
  }

  // W002: specificity < 0.5 → HIGH 변수 미채움
  if (style.specificity < 0.5) {
    weaknesses.push({
      id: 'W002',
      severity: 'HIGH',
      message: '변수 미채움: 프롬프트 변수의 절반 이상이 채워지지 않고 있습니다.',
      suggestion: '{{변수명}}을 실제 값으로 채워 AI에게 구체적인 맥락을 전달하세요.',
    });
  }

  // W003: verbosity < 0.15 → WARN 프롬프트 너무 짧음
  if (style.verbosity < 0.15) {
    weaknesses.push({
      id: 'W003',
      severity: 'WARN',
      message: '프롬프트 너무 짧음: 평균 프롬프트 길이가 600자 미만입니다.',
      suggestion: '역할, 맥락, 출력 형식을 추가해 AI가 의도를 정확히 파악하도록 하세요.',
    });
  }

  // W004: example_usage == 0 → INFO 예시 미사용
  if (style.example_usage === 0) {
    weaknesses.push({
      id: 'W004',
      severity: 'INFO',
      message: '예시 미사용: example slot을 한 번도 사용하지 않았습니다.',
      suggestion: 'Few-shot 예시를 추가하면 출력 일관성이 크게 향상됩니다.',
      fragment: 'example',
    });
  }

  // W005: imperative_clarity < 0.3 → WARN 명령형 부족
  if (style.imperative_clarity < 0.3) {
    weaknesses.push({
      id: 'W005',
      severity: 'WARN',
      message: '명령형 부족: 지시문이 soft directive로 처리될 수 있습니다.',
      suggestion:
        '"Do", "Always", "Never", "Return" 등 명령형 동사로 시작하는 문장을 늘리세요.',
    });
  }

  return weaknesses;
}
