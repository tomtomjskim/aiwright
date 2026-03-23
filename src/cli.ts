import { Command } from 'commander';
import {
  registerInitCommand,
  registerAddCommand,
  registerCreateCommand,
  registerApplyCommand,
  registerListCommand,
  registerBenchCommand,
  registerScoreCommand,
} from './commands/index.js';

const program = new Command();

program
  .name('aiwright')
  .description('Composable, measurable, shareable AI prompt library framework')
  .version('0.1.0');

registerInitCommand(program);
registerAddCommand(program);
registerCreateCommand(program);
registerApplyCommand(program);
registerListCommand(program);
registerBenchCommand(program);
registerScoreCommand(program);

program.parse();
