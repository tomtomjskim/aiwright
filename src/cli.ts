import { createRequire } from 'node:module';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  registerInitCommand,
  registerAddCommand,
  registerCreateCommand,
  registerApplyCommand,
  registerListCommand,
  registerBenchCommand,
  registerScoreCommand,
  registerIntelligenceCommand,
  registerLintCommand,
  registerStatusCommand,
  registerImproveCommand,
  registerHooksCommand,
} from './commands/index.js';
import { AiwrightError, CommandError } from './utils/errors.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('aiwright')
  .description('Composable, measurable, shareable AI prompt library framework')
  .version(pkg.version);

registerInitCommand(program);
registerAddCommand(program);
registerCreateCommand(program);
registerApplyCommand(program);
registerListCommand(program);
registerBenchCommand(program);
registerScoreCommand(program);
registerIntelligenceCommand(program);
registerLintCommand(program);
registerStatusCommand(program);
registerImproveCommand(program);
registerHooksCommand(program);

// 전역 에러 핸들러: throw된 AiwrightError를 포맷하여 출력 + 적절한 종료 코드 반환
program.parseAsync().catch((err: unknown) => {
  if (err instanceof CommandError) {
    console.error(chalk.red(err.format()));
    process.exit(err.exitCode);
  }
  if (err instanceof AiwrightError) {
    console.error(chalk.red(err.format()));
    process.exit(err.code === 'E004' ? 2 : 1);
  }
  if (err instanceof Error) {
    console.error(chalk.red(`Error: ${err.message}`));
  } else {
    console.error(chalk.red('Unexpected error'));
  }
  process.exit(1);
});
