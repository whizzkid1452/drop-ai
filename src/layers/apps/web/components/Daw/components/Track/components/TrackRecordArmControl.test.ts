// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { TrackRecordArmControl } from './TrackRecordArmControl';

const layerMocks = vi.hoisted(() => ({
  execute: vi.fn().mockResolvedValue(undefined),
  hasStoredRecording: true,
  recording: {
    activePlaylistId: 'playlist-1',
    playlists: [
      {
        compSegments: [],
        id: 'playlist-1',
        name: 'Playlist 1',
        takes: [
          {
            createdAtEpochMilliseconds: 1,
            durationSeconds: 4,
            id: 'take-1',
            sourceId: 'source-1',
            sourceStartTimeSeconds: 0,
            startTimeSeconds: 2,
            takeNumber: 1,
          },
        ],
      },
    ],
    recordMode: 'layered' as 'layered' | 'nonLayered' | 'soundOnSound',
  },
  state: {
    armedTrackIds: [] as string[],
    inputRoutes: [{ channelIndex: 0, deviceId: 'device-1', trackId: 'track-1' }],
    phase: 'idle' as 'idle' | 'recording',
  },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioRuntimeCapabilities: () => ({
    features: { linearRecording: { blockers: [], status: 'available' } },
  }),
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useEditorRuntimeState: () => ({
    selection: { range: { endTimeSeconds: 5, startTimeSeconds: 3, trackIds: ['track-1'] } },
  }),
  useLiveInputRuntimeState: () => ({ deviceId: 'device-1' }),
  useRecordingRuntimeState: () => ({ ...layerMocks.state, recordStartTimeSeconds: null }),
  useSession: (selector: (state: { tracks: Map<string, { recording?: typeof layerMocks.recording }> }) => unknown) =>
    selector({
      tracks: new Map([['track-1', { recording: layerMocks.hasStoredRecording ? layerMocks.recording : undefined }]]),
    }),
}));

vi.mock('../Track.css.ts', () => ({
  recordButtonActive: 'recordButtonActive',
  recordingError: 'recordingError',
  recordingOptions: 'recordingOptions',
  recordingSelect: 'recordingSelect',
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
  layerMocks.state.armedTrackIds = [];
  layerMocks.state.phase = 'idle';
  layerMocks.state.inputRoutes = [{ channelIndex: 0, deviceId: 'device-1', trackId: 'track-1' }];
  layerMocks.hasStoredRecording = true;
  layerMocks.recording.recordMode = 'layered';
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
    layerMocks.state.armedTrackIds = ['track-2'];
    layerMocks.state.phase = 'recording';
    const host = renderControl();

    expect(host.querySelector<HTMLButtonElement>('[aria-label="Vocal 녹음 arm"]')?.disabled).toBe(true);
  });

  it('저장된 녹음 상태가 없는 새 Track도 기본 녹음 모드를 변경할 수 있다', () => {
    layerMocks.hasStoredRecording = false;
    const host = renderControl();

    expect(host.querySelector<HTMLSelectElement>('[aria-label="Vocal 녹음 모드"]')?.disabled).toBe(false);
    expect(host.querySelector<HTMLSelectElement>('[aria-label="Vocal 녹음 모드"]')?.value).toBe('layered');
  });

  it('Track 입력 채널과 record mode를 명령으로 보낸다', async () => {
    const host = renderControl();
    const channel = host.querySelector<HTMLSelectElement>('[aria-label="Vocal 입력 채널"]');
    const mode = host.querySelector<HTMLSelectElement>('[aria-label="Vocal 녹음 모드"]');

    await act(async () => {
      if (channel) {
        channel.value = '1';
        channel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await act(async () => {
      if (mode) {
        mode.value = 'soundOnSound';
        mode.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    expect(layerMocks.execute).toHaveBeenCalledWith({
      channelIndex: 1,
      deviceId: 'device-1',
      trackId: 'track-1',
      type: AudioCommandType.SET_TRACK_RECORDING_INPUT,
    });
    expect(layerMocks.execute).toHaveBeenCalledWith({
      recordMode: 'soundOnSound',
      trackId: 'track-1',
      type: AudioCommandType.SET_TRACK_RECORD_MODE,
    });
  });

  it('선택한 Take 전체를 활성 Take로 보낸다', async () => {
    const host = renderControl();

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Vocal 선택 Take 전체 적용"]')?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      playlistId: 'playlist-1',
      takeId: 'take-1',
      trackId: 'track-1',
      type: AudioCommandType.SELECT_TAKE,
    });
  });

  it('선택 범위를 선택한 Take의 Comp 구간으로 보낸다', async () => {
    const host = renderControl();

    await act(async () =>
      host.querySelector<HTMLButtonElement>('[aria-label="Vocal 선택 범위를 Comp에 적용"]')?.click()
    );

    expect(layerMocks.execute).toHaveBeenCalledWith({
      compSegments: [
        expect.objectContaining({
          endTimeSeconds: 5,
          startTimeSeconds: 3,
          takeId: 'take-1',
        }),
      ],
      playlistId: 'playlist-1',
      trackId: 'track-1',
      type: AudioCommandType.SET_COMP_SEGMENTS,
    });
  });
});
