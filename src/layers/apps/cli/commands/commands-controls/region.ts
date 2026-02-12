import { AppController } from '@/layers/controllers';
import type { CliCommands, CliState } from '../../types';

export const createRegionCommands = (
  controller: AppController,
  state: CliState
): CliCommands => {
  return {
    region: {
      description: 'Region management',
      usage: 'region split <trackId> <time> | region remove <trackId> <regionId> | region move <trackId> <regionId> <time> | region list <trackId>',
      fn: async (sub: string, trackId: string, arg1: string, arg2?: string) => {
        if (sub === 'split') {
          // arg1: time
          if (!trackId || !arg1) return 'Error: Usage: region split <trackId> <time>';
          const time = parseFloat(arg1);
          if (isNaN(time)) return 'Error: Invalid time value.';
          await controller.region.splitRegion(trackId, time);
          return `Region split at ${time} on track ${trackId}`;
        } else if (sub === 'remove') {
          // arg1: regionId
          if (!trackId || !arg1) return 'Error: Usage: region remove <trackId> <regionId>';
          controller.region.removeRegion(trackId, arg1);
          return `Region ${arg1} removed from track ${trackId}`;
        } else if (sub === 'move') {
          // arg1: regionId, arg2: time
          if (!trackId || !arg1 || !arg2) return 'Error: Usage: region move <trackId> <regionId> <time>';
          const time = parseFloat(arg2);
          if (isNaN(time)) return 'Error: Invalid time value.';
          controller.region.moveRegion({ trackId, regionId: arg1, newStartTime: time });
          return `Region ${arg1} moved to ${time}s on track ${trackId}`;
        } else if (sub === 'list') {
             if (!trackId) return 'Error: Track ID required.';
             const track = state.tracks.get(trackId);
             if (!track) return `Error: Track ${trackId} not found.`;
             if (track.regions.length === 0) return `Track ${trackId} has no regions.`;
             
             const list = track.regions.map(r => 
               `  [${r.id}] Start: ${r.startTime.toFixed(2)}s, Dur: ${r.duration.toFixed(2)}s`
             ).join('\n');
             return `Regions in ${trackId}:\n${list}`;
        }
        return 'Usage: region split... | remove... | move... | list...';
      }
    }
  };
};
