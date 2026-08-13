// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioCommand } from '@/layers/shared/types/audioCommand.schema';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { AudioRuntimeFeature, type AudioRuntimeCapabilities } from '@/layers/shared/utils/audio-runtime-capabilities';
import { TrackInputMonitoringControl } from './TrackInputMonitoringControl';

const controlMocks = vi.hoisted(() => ({
  capabilities: null as AudioRuntimeCapabilities | null,
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
  state: { deviceId: null as string | null, monitoringTrackId: null as string | null },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioRuntimeCapabilities: () => controlMocks.capabilities,
  useCommandExecutor: () => ({ execute: controlMocks.execute }),
  useLiveInputRuntimeState: () => controlMocks.state,
}));

vi.mock('./LiveInputControls.css.ts', () => ({
  monitoringActive: 'monitoringActive',
  monitoringButton: 'monitoringButton',
}));

const availableCapabilities = {
  features: { [AudioRuntimeFeature.LIVE_INPUT]: { blockers: [], status: 'available' } },
} as unknown as AudioRuntimeCapabilities;
const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  controlMocks.capabilities = availableCapabilities;
  controlMocks.state = { deviceId: null, monitoringTrackId: null };
  controlMocks.execute.mockReset();
});

describe('TrackInputMonitoringControl', () => {
  it('Query 상태를 표시하고 반대 상태를 명령으로 전송한다', async () => {
    controlMocks.capabilities = availableCapabilities;
    controlMocks.state = { deviceId: 'mic-1', monitoringTrackId: 'track-1' };
    controlMocks.execute.mockResolvedValue(undefined);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    act(() => root.render(createElement(TrackInputMonitoringControl, { trackId: 'track-1', trackName: 'Vocal' })));
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Vocal 입력 모니터링"]');

    expect(button?.getAttribute('aria-pressed')).toBe('true');
    await act(async () => button?.click());

    expect(controlMocks.execute).toHaveBeenCalledWith({
      enabled: false,
      trackId: 'track-1',
      type: AudioCommandType.SET_INPUT_MONITORING,
    });
  });
});
