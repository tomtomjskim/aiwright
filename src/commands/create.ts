import path from 'node:path';
import fs from 'node:fs/promises';
import { Command } from 'commander';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { FragmentSchema } from '../schema/fragment.js';
import { ensureDir, fileExists } from '../utils/fs.js';
import { ValidationError, FileIOError, CommandError } from '../utils/errors.js';

export function registerCreateCommand(program: Command): void {
  program
    .command('create')
    .description('Create a new fragment file with YAML frontmatter')
    .requiredOption('--name <name>', 'Fragment name (lowercase, a-z0-9-)')
    .requiredOption('--slot <slot>', 'Prompt slot (system/context/instruction/constraint/output/example/custom)')
    .option('--priority <priority>', 'Priority 0-999 (default: 50)', '50')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--description <desc>', 'Fragment description', 'A new fragment')
    .option('--body <text>', 'Fragment body text')
    .option('--body-file <path>', 'Read body from file')
    .action(async (opts: {
      name: string;
      slot: string;
      priority: string;
      tags?: string;
      description: string;
      body?: string;
      bodyFile?: string;
    }) => {
      const projectDir = process.cwd();

      // Validate name
      if (!/^[a-z0-9][a-z0-9-]*$/.test(opts.name)) {
        throw new ValidationError(
          'Fragment name must match /^[a-z0-9][a-z0-9-]*$/',
          'Use only lowercase letters, digits, and hyphens (e.g., my-fragment)',
        );
      }

      // Validate slot
      const validSlots = ['system', 'context', 'instruction', 'constraint', 'output', 'example', 'custom'];
      if (!validSlots.includes(opts.slot)) {
        throw new ValidationError(
          `Invalid slot "${opts.slot}"`,
          `Valid slots are: ${validSlots.join(', ')}`,
        );
      }

      // Validate priority
      const priority = parseInt(opts.priority, 10);
      if (isNaN(priority) || priority < 0 || priority > 999) {
        throw new ValidationError('Priority must be an integer between 0 and 999');
      }

      // Get body
      let body: string;
      if (opts.bodyFile) {
        const bodyFilePath = path.resolve(projectDir, opts.bodyFile);
        try {
          body = (await fs.readFile(bodyFilePath, 'utf-8')).trim();
        } catch {
          throw new FileIOError(bodyFilePath, 'Cannot read body file');
        }
      } else if (opts.body) {
        body = opts.body.trim();
      } else {
        throw new ValidationError('Either --body or --body-file is required');
      }

      if (!body) {
        throw new ValidationError('Fragment body cannot be empty');
      }

      const tags = opts.tags
        ? opts.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      // Build frontmatter
      const frontmatter: Record<string, unknown> = {
        name: opts.name,
        version: '0.1.0',
        description: opts.description,
        slot: opts.slot,
        priority,
      };

      if (tags.length > 0) {
        frontmatter.tags = tags;
      }

      // Validate with Zod
      const parsed = FragmentSchema.safeParse(frontmatter);
      if (!parsed.success) {
        const details = parsed.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join('\n  ');
        throw new ValidationError(`Invalid fragment metadata:\n  ${details}`);
      }

      // Build file content
      const frontmatterStr = yaml.dump(frontmatter, { lineWidth: 120 }).trimEnd();
      const fileContent = `---\n${frontmatterStr}\n---\n\n${body}\n`;

      // Write file
      const targetDir = path.join(projectDir, '.aiwright', 'fragments');
      await ensureDir(targetDir);
      const targetPath = path.join(targetDir, `${opts.name}.md`);

      if (await fileExists(targetPath)) {
        throw new CommandError(
          `Fragment "${opts.name}" already exists: ${targetPath}`,
          1,
          'Remove the file first if you want to recreate it',
        );
      }

      await fs.writeFile(targetPath, fileContent, 'utf-8');

      console.log(chalk.green('✔') + ` Created fragment ${chalk.bold(opts.name)}`);
      console.log(chalk.dim(`  → ${targetPath}`));
      console.log(chalk.dim(`  slot: ${opts.slot}  priority: ${priority}`));
    });
}
