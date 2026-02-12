import { AppController } from '@/layers/controllers';
import type { CliCommands, CliState } from '../types';

export const createExportCommands = (
  controller: AppController,
  _state: CliState
): CliCommands => {
  return {
    export: {
      description: 'Export project',
      usage: 'export all | export range <start> <end>',
      fn: async (sub: string, start?: string, end?: string) => {
        if (sub === 'all') {
          await controller.export.exportProject();
          return 'Project exported successfully (all)';
        } else if (sub === 'range') {
          if (!start || !end) return 'Error: Usage: export range <start> <end>';
          const startTime = parseFloat(start);
          const endTime = parseFloat(end);
          if (isNaN(startTime) || isNaN(endTime)) return 'Error: Invalid time values.';
          await controller.export.exportRange(startTime, endTime);
          return `Project exported (${startTime}s - ${endTime}s)`;
        }
        return 'Usage: export all OR export range <start> <end>';
      }
    }
  };
};
