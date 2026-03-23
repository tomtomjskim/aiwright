import path from 'node:path';
import fs from 'node:fs/promises';
import { AdapterContract, ApplyResult, ComposedPrompt, DetectResult } from './contract.js';
import { fileExists, ensureDir } from '../utils/fs.js';

/**
 * Claude Code 어댑터 — 분리 참조 구조
 *
 * 기존: CLAUDE.md에 마커로 직접 주입 (덮어쓰기 위험)
 * 변경: .claude/CLAUDE.md를 aiwright가 소유 (루트 CLAUDE.md 건드리지 않음)
 *
 * Claude Code는 루트 CLAUDE.md + .claude/CLAUDE.md 둘 다 읽으므로:
 * - 루트 CLAUDE.md = 사람이 관리 (프로젝트 규칙, 컨벤션)
 * - .claude/CLAUDE.md = aiwright 소유 (AI 프롬프트 설정)
 */

const HEADER = `# AI Prompt Configuration (managed by aiwright)
# Do not edit manually — run \`aiwright apply\` to regenerate
`;

export class ClaudeCodeAdapter implements AdapterContract {
  readonly name = 'claude-code';
  readonly description = 'Claude Code (.claude/CLAUDE.md — separate from root CLAUDE.md)';

  async detect(projectDir: string): Promise<DetectResult> {
    const claudeDir = path.join(projectDir, '.claude');
    const claudeMd = path.join(projectDir, 'CLAUDE.md');

    const hasClaudeDir = await fileExists(claudeDir);
    const hasClaudeMd = await fileExists(claudeMd);

    if (hasClaudeDir) {
      return { detected: true, confidence: 0.95, reason: '.claude/ directory found' };
    }
    if (hasClaudeMd) {
      return { detected: true, confidence: 0.7, reason: 'CLAUDE.md found (no .claude/ directory)' };
    }
    return { detected: false, confidence: 0, reason: 'Neither .claude/ nor CLAUDE.md found' };
  }

  /**
   * .claude/CLAUDE.md에 합성된 프롬프트를 작성한다.
   * 루트 CLAUDE.md는 건드리지 않는다.
   */
  async apply(prompt: ComposedPrompt, projectDir: string): Promise<ApplyResult> {
    const claudeDir = path.join(projectDir, '.claude');
    await ensureDir(claudeDir);

    const outputPath = path.join(claudeDir, 'CLAUDE.md');
    const content = `${HEADER}\n${prompt.fullText}\n`;

    await fs.writeFile(outputPath, content, 'utf-8');

    return {
      success: true,
      outputPaths: [outputPath],
      message: `Applied to .claude/CLAUDE.md (root CLAUDE.md untouched)`,
    };
  }

  /**
   * .claude/CLAUDE.md에서 현재 적용된 프롬프트를 읽는다.
   */
  async read(projectDir: string): Promise<ComposedPrompt | null> {
    const outputPath = path.join(projectDir, '.claude', 'CLAUDE.md');

    if (!(await fileExists(outputPath))) return null;

    const content = await fs.readFile(outputPath, 'utf-8');
    // HEADER 이후의 내용만 추출
    const headerEnd = content.indexOf('\n\n');
    const promptText = headerEnd !== -1 ? content.slice(headerEnd + 2).trim() : content.trim();

    return {
      sections: new Map([['full', promptText]]),
      fullText: promptText,
      fragments: [],
      resolvedVars: {},
    };
  }

  /**
   * .claude/CLAUDE.md를 삭제한다. 루트 CLAUDE.md는 건드리지 않는다.
   */
  async remove(projectDir: string): Promise<ApplyResult> {
    const outputPath = path.join(projectDir, '.claude', 'CLAUDE.md');

    if (!(await fileExists(outputPath))) {
      return { success: true, outputPaths: [], message: 'No .claude/CLAUDE.md found' };
    }

    await fs.unlink(outputPath);

    return {
      success: true,
      outputPaths: [outputPath],
      message: 'Removed .claude/CLAUDE.md (root CLAUDE.md untouched)',
    };
  }
}
