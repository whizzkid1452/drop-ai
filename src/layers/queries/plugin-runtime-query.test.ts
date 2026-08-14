import { describe, expect, it, vi } from 'vitest';
import { PluginRuntimeQuery } from './plugin-runtime-query';

describe('PluginRuntimeQuery', () => {
  it('Plugin runtime 상태를 복제해 반환한다', () => {
    const state = { instanceId: 'plugin-1', latencySamples: 128, reason: null, status: 'active' as const };
    const readPluginRuntimeStates = vi.fn(() => [state]);
    const query = new PluginRuntimeQuery({ readPluginRuntimeStates });

    const [snapshot] = query.readTrack('track-1');

    expect(readPluginRuntimeStates).toHaveBeenCalledWith('track-1');
    expect(snapshot).toEqual(state);
    expect(snapshot).not.toBe(state);
  });
});
