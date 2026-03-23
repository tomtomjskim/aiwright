import path from 'node:path';
import fs from 'node:fs/promises';
import { AdapterContract, ApplyResult, ComposedPrompt, DetectResult } from './contract.js';
import { fileExists, ensureDir } from '../utils/fs.js';

const HEADER = `# AI Prompt Configuration (managed by aiwright)
# Run \`aiwright apply\` to regenerate
`;

const TARGET_FILE = '.github/copilot-instructions.md';
const BACKUP_FILE = '.github/copilot-instructions.md.backup';

function isManagedByAiwright(content: string): boolean {
  return content.startsWith('# AI Prompt Configuration (managed by aiwright)');
}

export class CopilotAdapter implements AdapterContract {
  readonly name = 'copilot';
  readonly description = 'GitHub Copilot (.github/copilot-instructions.md — full ownership)';

  async detect(projectDir: string): Promise<DetectResult> {
    const targetPath = path.join(projectDir, TARGET_FILE);

    if (await fileExists(targetPath)) {
      return { detected: true, confidence: 0.9, reason: '.github/copilot-instructions.md found' };
    }
    return { detected: false, confidence: 0, reason: '.github/copilot-instructions.md not found' };
  }

  async apply(prompt: ComposedPrompt, projectDir: string): Promise<ApplyResult> {
    const targetPath = path.join(projectDir, TARGET_FILE);
    const backupPath = path.join(projectDir, BACKUP_FILE);

    // .github/ 디렉터리 자동 생성
    await ensureDir(path.join(projectDir, '.github'));

    // 기존 파일이 있고 aiwright가 만든 게 아니면 백업
    if (await fileExists(targetPath)) {
      const existing = await fs.readFile(targetPath, 'utf-8');
      if (!isManagedByAiwright(existing)) {
        await fs.writeFile(backupPath, existing, 'utf-8');
      }
    }

    const content = `${HEADER}\n${prompt.fullText}\n`;
    await fs.writeFile(targetPath, content, 'utf-8');

    return {
      success: true,
      outputPaths: [targetPath],
      message: `Applied to ${TARGET_FILE}`,
    };
  }

  async read(projectDir: string): Promise<ComposedPrompt | null> {
    const targetPath = path.join(projectDir, TARGET_FILE);

    if (!(await fileExists(targetPath))) return null;

    const content = await fs.readFile(targetPath, 'utf-8');
    const headerEnd = content.indexOf('\n\n');
    const promptText = headerEnd !== -1 ? content.slice(headerEnd + 2).trim() : content.trim();

    return {
      sections: new Map([['full', promptText]]),
      fullText: promptText,
      fragments: [],
      resolvedVars: {},
    };
  }

  async remove(projectDir: string): Promise<ApplyResult> {
    const targetPath = path.join(projectDir, TARGET_FILE);
    const backupPath = path.join(projectDir, BACKUP_FILE);

    if (!(await fileExists(targetPath))) {
      return { success: true, outputPaths: [], message: `No ${TARGET_FILE} found` };
    }

    await fs.unlink(targetPath);

    // 백업이 있으면 복원
    if (await fileExists(backupPath)) {
      const backup = await fs.readFile(backupPath, 'utf-8');
      await fs.writeFile(targetPath, backup, 'utf-8');
      await fs.unlink(backupPath);
      return {
        success: true,
        outputPaths: [targetPath],
        message: `Removed ${TARGET_FILE} and restored from backup`,
      };
    }

    return {
      success: true,
      outputPaths: [targetPath],
      message: `Removed ${TARGET_FILE}`,
    };
  }
}
