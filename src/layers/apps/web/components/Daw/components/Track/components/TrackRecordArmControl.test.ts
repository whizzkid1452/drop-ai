// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { TrackRecordArmControl } from './TrackRecordArmControl';

const layerMocks = vi.hoisted(() => ({
  execute: vi.fn().mockResolvedValue(undefined),
  state: { armedTrackId: null as string | null, phase: 'idle' as 'idle' | 'recording' },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioRuntimeCapabilities: () => ({
    features: { linearRecording: { blockers: [], status: 'available' } },
  }),
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useRecordingRuntimeState: () => ({ ...layerMocks.state, recordStartTimeSeconds: null }),
}));

vi.mock('../Track.css.ts', () => ({
  recordButtonActive: 'recordButtonActive',
  trackActionButton: 'trackActionButton',
}));

const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderControl(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(TrackRecordArmControl, { trackId: 'track-1', trackName: 'Vocal' })));
  return host;
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  layerMocks.execute.mockClear();
  layerMocks.state.armedTrackId = null;
  layerMocks.state.phase = 'idle';
});

describe('TrackRecordArmControl', () => {
  it('Track의 반대 arm 상태를 명령으로 보낸다', async () => {
    const host = renderControl();
    const button = host.querySelector<HTMLButtonElement>('[aria-label="Vocal 녹음 arm"]');

    await act(async () => button?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      armed: true,
      trackId: 'track-1',
      type: AudioCommandType.SET_TRACK_RECORD_ARM,
    });
  });

  it('다른 Track 녹음 중에는 arm 변경을 비활성화한다', () => {
    layerMocks.state.armedTrackId = 'track-2';
    layerMocks.state.phase = 'recording';
    const host = renderControl();

    expect(host.querySelector<HTMLButtonElement>('[aria-label="Vocal 녹음 arm"]')?.disabled).toBe(true);
  });
});
