import path from 'node:path';
import fs from 'node:fs/promises';
import { AdapterContract, ApplyResult, ComposedPrompt, DetectResult } from './contract.js';
import { fileExists } from '../utils/fs.js';

const MARKER_START = '<!-- aiwright:start -->';
const MARKER_END = '<!-- aiwright:end -->';

export class ClaudeCodeAdapter implements AdapterContract {
  readonly name = 'claude-code';
  readonly description = 'Claude Code (CLAUDE.md + .claude/)';

  async detect(projectDir: string): Promise<DetectResult> {
    const claudeDir = path.join(projectDir, '.claude');
    const claudeMd = path.join(projectDir, 'CLAUDE.md');

    const hasClaudeDir = await fileExists(claudeDir);
    const hasClaudeMd = await fileExists(claudeMd);

    if (hasClaudeDir) {
      return {
        detected: true,
        confidence: 0.95,
        reason: '.claude/ directory found',
      };
    }

    if (hasClaudeMd) {
      return {
        detected: true,
        confidence: 0.7,
        reason: 'CLAUDE.md found (no .claude/ directory)',
      };
    }

    return {
      detected: false,
      confidence: 0,
      reason: 'Neither .claude/ nor CLAUDE.md found',
    };
  }

  async apply(prompt: ComposedPrompt, projectDir: string): Promise<ApplyResult> {
    const claudeMdPath = path.join(projectDir, 'CLAUDE.md');
    const markerBlock = `${MARKER_START}\n${prompt.fullText}\n${MARKER_END}`;

    let existingContent = '';
    if (await fileExists(claudeMdPath)) {
      existingContent = await fs.readFile(claudeMdPath, 'utf-8');
    }

    let newContent: string;

    const startIdx = existingContent.indexOf(MARKER_START);
    const endIdx = existingContent.indexOf(MARKER_END);

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      // 마커 사이 교체 (마커 포함), 마커 밖 내용 보존
      const before = existingContent.slice(0, startIdx);
      const after = existingContent.slice(endIdx + MARKER_END.length);
      newContent = `${before}${markerBlock}${after}`;
    } else {
      // 마커 없으면 파일 끝에 추가
      const separator = existingContent.length > 0 && !existingContent.endsWith('\n')
        ? '\n\n'
        : existingContent.length > 0
          ? '\n'
          : '';
      newContent = `${existingContent}${separator}${markerBlock}\n`;
    }

    await fs.writeFile(claudeMdPath, newContent, 'utf-8');

    return {
      success: true,
      outputPaths: [claudeMdPath],
      message: `Applied to CLAUDE.md via aiwright markers`,
    };
  }

  async read(projectDir: string): Promise<ComposedPrompt | null> {
    const claudeMdPath = path.join(projectDir, 'CLAUDE.md');

    if (!(await fileExists(claudeMdPath))) {
      return null;
    }

    const content = await fs.readFile(claudeMdPath, 'utf-8');
    const startIdx = content.indexOf(MARKER_START);
    const endIdx = content.indexOf(MARKER_END);

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      return null;
    }

    const innerText = content
      .slice(startIdx + MARKER_START.length, endIdx)
      .replace(/^\n/, '')
      .replace(/\n$/, '');

    const sections = new Map<string, string>();
    sections.set('full', innerText);

    return {
      sections,
      fullText: innerText,
      fragments: [],
      resolvedVars: {},
    };
  }

  async remove(projectDir: string): Promise<ApplyResult> {
    const claudeMdPath = path.join(projectDir, 'CLAUDE.md');

    if (!(await fileExists(claudeMdPath))) {
      return {
        success: true,
        outputPaths: [],
        message: 'CLAUDE.md not found; nothing to remove',
      };
    }

    const content = await fs.readFile(claudeMdPath, 'utf-8');
    const startIdx = content.indexOf(MARKER_START);
    const endIdx = content.indexOf(MARKER_END);

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      return {
        success: true,
        outputPaths: [],
        message: 'No aiwright markers found in CLAUDE.md; nothing to remove',
      };
    }

    // 마커 섹션 제거 (앞뒤 개행 정리)
    const before = content.slice(0, startIdx).replace(/\n+$/, '');
    const after = content.slice(endIdx + MARKER_END.length).replace(/^\n+/, '');

    let newContent: string;
    if (before.length > 0 && after.length > 0) {
      newContent = `${before}\n\n${after}`;
    } else if (before.length > 0) {
      newContent = `${before}\n`;
    } else if (after.length > 0) {
      newContent = after;
    } else {
      newContent = '';
    }

    await fs.writeFile(claudeMdPath, newContent, 'utf-8');

    return {
      success: true,
      outputPaths: [claudeMdPath],
      message: 'Removed aiwright section from CLAUDE.md',
    };
  }
}
