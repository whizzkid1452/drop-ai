import { AppController } from '@/layers/controllers';
import type { CliCommands, CliState } from './types';
import { createTransportCommands } from './commands/transport';
import { createTrackCommands } from './commands/track';
import { createRegionCommands } from './commands/region';
import { createExportCommands } from './commands/export';
import { createInfoCommands } from './commands/info';

export const createCliCommands = (
  controller: AppController,
  state: CliState
): CliCommands => {
  const commands: CliCommands = {
    ...createTransportCommands(controller, state),
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
