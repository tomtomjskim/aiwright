import { FragmentFile, Slot } from '../schema/fragment.js';
import { ComposedPrompt } from '../adapter/contract.js';

/** slot 순서 (MPO 근거: 섹션 순서 고정 → 안정성) */
const SLOT_ORDER: Slot[] = [
  'system',
  'context',
  'instruction',
  'constraint',
  'output',
  'example',
  'custom',
];

/**
 * Fragment[] → ComposedPrompt
 *
 * 1. enabled=true인 Fragment만 필터링
 * 2. slot별 그룹핑
 * 3. 각 그룹 내 priority 오름차순 정렬
 * 4. slot 순서 적용
 * 5. Fragment body 결합 (구분자: "\n\n")
 */
export function compose(
  fragments: FragmentFile[],
  enabledNames?: Set<string>,
): ComposedPrompt {
  const active = enabledNames
    ? fragments.filter((f) => enabledNames.has(f.meta.name))
    : fragments;

  // slot별 그룹핑
  const grouped = new Map<string, FragmentFile[]>();
  for (const slot of SLOT_ORDER) {
    grouped.set(slot, []);
  }

  for (const frag of active) {
    const slot = frag.meta.slot;
    const key = slot === 'custom' && frag.meta.slot_name ? frag.meta.slot_name : slot;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(frag);
  }

  // 각 그룹 내 priority 오름차순 정렬
  for (const group of grouped.values()) {
    group.sort((a, b) => a.meta.priority - b.meta.priority);
  }

  // 섹션 구성
  const sections: Record<string, string> = {};
  const orderedKeys = [
    ...SLOT_ORDER,
    // custom slot_name 추가
    ...Array.from(grouped.keys()).filter((k) => !SLOT_ORDER.includes(k as Slot)),
  ];

  const parts: string[] = [];
  const usedFragmentNames: string[] = [];
  const resolvedVars: Record<string, unknown> = {};

  for (const key of orderedKeys) {
    const group = grouped.get(key);
    if (!group || group.length === 0) continue;

    const sectionParts = group.map((f) => f.body);
    const sectionText = sectionParts.join('\n\n');
    sections[key] = sectionText;
    parts.push(sectionText);

    for (const f of group) {
      usedFragmentNames.push(f.meta.name);
      // 변수 기본값 수집
      for (const [varName, varDef] of Object.entries(f.meta.variables)) {
        if (varDef.default !== undefined && !(varName in resolvedVars)) {
          resolvedVars[varName] = varDef.default;
        }
      }
    }
  }

  const fullText = parts.join('\n\n');

  return {
    sections,
    fullText,
    fragments: usedFragmentNames,
    resolvedVars,
  };
}
