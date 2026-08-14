import { describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IObjectUrlAdapter } from '../audio-source-registry/i-object-url-adapter';
import { createSessionStore, type RegionState, type TrackState } from '../session/session';
import { createDefaultRegionProcessingState } from '../shared/types/region-processing';
import { RegionController } from './region-controller';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_ID = '33333333-3333-4333-8333-333333333333';
const REGION_ID = '44444444-4444-4444-8444-444444444444';

class FakeObjectUrlAdapter implements IObjectUrlAdapter {
  readonly createObjectUrl = vi.fn(() => `blob:test-${this.createObjectUrl.mock.calls.length}`);
  readonly revokeObjectUrl = vi.fn();
}

function createRegion(): RegionState {
  return {
    ...createDefaultRegionProcessingState(),
    duration: 2,
    endTime: 3,
    id: REGION_ID,
    sourceId: SOURCE_ID,
    sourceStartTime: 0,
    startTime: 1,
    status: [],
  };
}

async function createRuntime() {
  const sessionStore = createSessionStore({
    initialProjectMetadata: { id: PROJECT_ID, name: '편집 runtime', revision: 0 },
  });
  const track: TrackState = {
    id: TRACK_ID,
    isMuted: false,
    isSoloed: false,
    name: 'Audio',
    pan: 0,
    pluginInstances: [],
    regions: [createRegion()],
    status: [],
    volume: 1,
  };
  sessionStore.getState().addTrack(track);

  const audioEngine = new MockAudioEngine();
  await audioEngine.addTrack(TRACK_ID);
  const objectUrlAdapter = new FakeObjectUrlAdapter();
  const audioSourceRegistry = new AudioSourceRegistry(objectUrlAdapter);
  const source = audioSourceRegistry.restoreCommitted({
    blob: new Blob(['audio'], { type: 'audio/wav' }),
    metadata: {
      byteLength: 5,
      durationSeconds: 10,
      fileName: 'audio.wav',
      id: SOURCE_ID,
      mimeType: 'audio/wav',
    },
  });
  audioSourceRegistry.attach({ regionId: REGION_ID, sourceId: SOURCE_ID });
  await audioEngine.addRegion(TRACK_ID, {
    duration: 2,
    fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
    fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
    gain: 1,
    id: REGION_ID,
    isOpaque: false,
    layer: 0,
    sourceStartTime: 0,
    startTime: 1,
    url: source.objectUrl,
  });
  const controller = new RegionController({ audioEngine, audioSourceRegistry, sessionStore });
  return { audioEngine, audioSourceRegistry, controller, objectUrlAdapter, sessionStore };
}

describe('RegionController 편집 runtime 교체', () => {
  it('준비한 Audio graph와 Source 연결을 활성화한 뒤 Session을 한 번에 교체한다', async () => {
    const { audioEngine, audioSourceRegistry, controller, sessionStore } = await createRuntime();
    const prepareProjectGraph = vi.spyOn(audioEngine, 'prepareProjectGraph');

    await controller.replaceTrackRegions({
      tracks: [
        {
          trackId: TRACK_ID,
          regions: [
            {
              ...createDefaultRegionProcessingState(),
              durationSeconds: 1.5,
              id: REGION_ID,
              sourceId: SOURCE_ID,
              sourceStartTimeSeconds: 0.5,
              startTimeSeconds: 4,
            },
          ],
        },
      ],
    });

    expect(prepareProjectGraph).toHaveBeenCalledOnce();
    expect(sessionStore.getState().tracks.get(TRACK_ID)?.regions).toEqual([
      {
        ...createDefaultRegionProcessingState(),
        duration: 1.5,
        endTime: 5.5,
        id: REGION_ID,
        sourceId: SOURCE_ID,
        sourceStartTime: 0.5,
        startTime: 4,
        status: [],
      },
    ]);
    expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([REGION_ID]);
  });

  it('Audio graph 준비 실패 시 active Session과 Source Registry를 유지한다', async () => {
    const { audioEngine, audioSourceRegistry, controller, sessionStore } = await createRuntime();
    vi.spyOn(audioEngine, 'prepareProjectGraph').mockRejectedValueOnce(new Error('그래프 준비 실패'));

    await expect(
      controller.replaceTrackRegions({
        tracks: [{ trackId: TRACK_ID, regions: [] }],
      })
    ).rejects.toThrow('그래프 준비 실패');

    expect(sessionStore.getState().tracks.get(TRACK_ID)?.regions).toEqual([createRegion()]);
    expect(audioSourceRegistry.resolve(SOURCE_ID)?.regionIds).toEqual([REGION_ID]);
  });
});
