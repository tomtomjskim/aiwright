import path from 'node:path';
import fs from 'node:fs/promises';
import { Command } from 'commander';
import chalk from 'chalk';
import yaml from 'js-yaml';
import { FragmentSchema } from '../schema/fragment.js';
import { ensureDir, fileExists } from '../utils/fs.js';

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

      try {
        // Validate name
        if (!/^[a-z0-9][a-z0-9-]*$/.test(opts.name)) {
          console.error(chalk.red('Error [E004]: Fragment name must match /^[a-z0-9][a-z0-9-]*$/'));
          console.error(chalk.dim('  Suggestion: Use only lowercase letters, digits, and hyphens (e.g., my-fragment)'));
          process.exit(2);
        }

        // Validate slot
        const validSlots = ['system', 'context', 'instruction', 'constraint', 'output', 'example', 'custom'];
        if (!validSlots.includes(opts.slot)) {
          console.error(chalk.red(`Error [E004]: Invalid slot "${opts.slot}"`));
          console.error(chalk.dim(`  Suggestion: Valid slots are: ${validSlots.join(', ')}`));
          process.exit(2);
        }

        // Validate priority
        const priority = parseInt(opts.priority, 10);
        if (isNaN(priority) || priority < 0 || priority > 999) {
          console.error(chalk.red('Error [E004]: Priority must be an integer between 0 and 999'));
          process.exit(2);
        }

        // Get body
        let body: string;
        if (opts.bodyFile) {
          const bodyFilePath = path.resolve(projectDir, opts.bodyFile);
          try {
            body = (await fs.readFile(bodyFilePath, 'utf-8')).trim();
          } catch {
            console.error(chalk.red(`Error [E005]: Cannot read body file: ${bodyFilePath}`));
            process.exit(1);
          }
        } else if (opts.body) {
          body = opts.body.trim();
        } else {
          console.error(chalk.red('Error [E004]: Either --body or --body-file is required'));
          process.exit(2);
        }

        if (!body) {
          console.error(chalk.red('Error [E004]: Fragment body cannot be empty'));
          process.exit(2);
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
          console.error(chalk.red(`Error [E004]: Invalid fragment metadata:\n  ${details}`));
          process.exit(2);
        }

        // Build file content
        const frontmatterStr = yaml.dump(frontmatter, { lineWidth: 120 }).trimEnd();
        const fileContent = `---\n${frontmatterStr}\n---\n\n${body}\n`;

        // Write file
        const targetDir = path.join(projectDir, '.aiwright', 'fragments');
        await ensureDir(targetDir);
        const targetPath = path.join(targetDir, `${opts.name}.md`);

        if (await fileExists(targetPath)) {
          console.error(chalk.yellow(`Fragment "${opts.name}" already exists: ${targetPath}`));
          console.error(chalk.dim('  Remove the file first if you want to recreate it'));
          process.exit(1);
        }

        await fs.writeFile(targetPath, fileContent, 'utf-8');

        console.log(chalk.green('✔') + ` Created fragment ${chalk.bold(opts.name)}`);
        console.log(chalk.dim(`  → ${targetPath}`));
        console.log(chalk.dim(`  slot: ${opts.slot}  priority: ${priority}`));
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(`Error [E005]: ${err.message}`));
        } else {
          console.error(chalk.red('Unexpected error during create'));
        }
        process.exit(1);
      }
    });
}
