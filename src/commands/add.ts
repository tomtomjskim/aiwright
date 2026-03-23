import path from 'node:path';
import fs from 'node:fs/promises';
import { Command } from 'commander';
import chalk from 'chalk';
import matter from 'gray-matter';
import { FragmentSchema } from '../schema/fragment.js';
import { fileExists, ensureDir } from '../utils/fs.js';
import { InvalidFragmentError } from '../utils/errors.js';

function defaultBuiltinsDir(): string {
  return path.join(new URL('../../builtins', import.meta.url).pathname);
}

async function validateFragmentFile(filePath: string): Promise<void> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new InvalidFragmentError(filePath, 'Cannot read file');
  }

  const parsed = matter(raw);
  const body = parsed.content.trim();

  if (!body) {
    throw new InvalidFragmentError(filePath, 'Fragment body is empty');
  }

  const result = FragmentSchema.safeParse(parsed.data);
  if (!result.success) {
    const details = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw new InvalidFragmentError(filePath, details);
  }
}

export function registerAddCommand(program: Command): void {
  program
    .command('add <name>')
    .description('Add a fragment to .aiwright/fragments/')
    .action(async (name: string) => {
      const projectDir = process.cwd();
      const targetDir = path.join(projectDir, '.aiwright', 'fragments');
      const targetPath = path.join(targetDir, `${path.basename(name, '.md')}.md`);

      try {
        // local file path (starts with . or /)
        const isLocalPath = name.startsWith('./') || name.startsWith('/') || name.endsWith('.md');

        let sourcePath: string;

        if (isLocalPath) {
          sourcePath = path.resolve(projectDir, name);

          if (!(await fileExists(sourcePath))) {
            console.error(chalk.red(`Error [E001]: File not found: ${sourcePath}`));
            console.error(chalk.dim('  Suggestion: Check the file path'));
            process.exit(1);
          }

          // validate before copying
          await validateFragmentFile(sourcePath);
        } else {
          // builtin fragment lookup
          const builtinsDir = defaultBuiltinsDir();
          sourcePath = path.join(builtinsDir, `${name}.md`);

          if (!(await fileExists(sourcePath))) {
            console.error(chalk.red(`Error [E001]: Fragment "${name}" not found`));
            console.error(chalk.dim('  Suggestion: Run "aiwright list" to see available fragments'));
            process.exit(1);
          }
        }

        await ensureDir(targetDir);

        if (await fileExists(targetPath)) {
          console.log(chalk.yellow(`Fragment "${path.basename(targetPath, '.md')}" already exists at ${targetPath}`));
          console.log(chalk.dim('  Use --force to overwrite (not yet implemented)'));
          process.exit(0);
        }

        const content = await fs.readFile(sourcePath, 'utf-8');
        await fs.writeFile(targetPath, content, 'utf-8');

        const fragName = path.basename(targetPath, '.md');
        console.log(chalk.green('✔') + ` Added fragment ${chalk.bold(fragName)}`);
        console.log(chalk.dim(`  → ${targetPath}`));
      } catch (err) {
        if (err instanceof InvalidFragmentError) {
          console.error(chalk.red(err.format()));
          console.error(chalk.dim(`  Suggestion: ${err.suggestion ?? 'Check the YAML frontmatter'}`));
          process.exit(2);
        }
        if (err instanceof Error) {
          console.error(chalk.red(`Error [E005]: ${err.message}`));
        } else {
          console.error(chalk.red('Unexpected error during add'));
        }
        process.exit(1);
      }
    });
}
