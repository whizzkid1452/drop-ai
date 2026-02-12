import { AppController } from '@/layers/controllers';
import type { CliCommands, CliState } from '../types';
import { 
  createPlayCommands,
  createTrackCommands,
  createRegionCommands,
  createExportCommands,
  createInfoCommands
} from './commands-controls';

export const createCliCommands = (
  controller: AppController,
  state: CliState
): CliCommands => {
  const commands: CliCommands = {
    ...createPlayCommands(controller, state),
    ...createTrackCommands(controller, state),
    ...createRegionCommands(controller, state),
    ...createExportCommands(controller, state),
    ...createInfoCommands(controller, state),
  };

  // Help command needs access to the full list of commands
  commands.help = {
    description: 'Show available commands',
    usage: 'help',
    fn: () => {
      const list = Object.entries(commands)
        .map(([name, cmd]) => `  ${name.padEnd(12)} - ${cmd.description}`)
        .join('\n');
      return 'Available commands:\n' + list + '\n\nType "<command> --help" for usage details.';
    }
  };

  return commands;
};
