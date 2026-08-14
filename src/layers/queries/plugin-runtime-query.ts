import type { PluginRuntimeState } from '../shared/types/plugin-state';

interface PluginRuntimeStateSource {
  readPluginRuntimeStates(trackId: string): readonly PluginRuntimeState[];
}

export interface IPluginRuntimeQuery {
  readTrack(trackId: string): readonly PluginRuntimeState[];
}

export class PluginRuntimeQuery implements IPluginRuntimeQuery {
  constructor(private readonly source: PluginRuntimeStateSource) {}

  readTrack(trackId: string): readonly PluginRuntimeState[] {
    return this.source.readPluginRuntimeStates(trackId).map(state => ({ ...state }));
  }
}
