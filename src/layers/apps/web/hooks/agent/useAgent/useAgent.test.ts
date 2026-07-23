import { describe, expect, it, vi } from 'vitest';
import type { IAudioSourceResolver, RuntimeAudioSource } from '@/layers/audio-source-registry/i-audio-source-registry';
import type { TrackState } from '@/layers/session/session';
import { createAgentPromptPlugins, createAgentPromptTracks } from './useAgent';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const ATTACHED_REGION_ID = '22222222-2222-4222-8222-222222222222';
const DETACHED_REGION_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_REGION_ID = '44444444-4444-4444-8444-444444444444';
const ATTACHED_SOURCE_ID = '66666666-6666-4666-8666-666666666666';
const DETACHED_SOURCE_ID = '77777777-7777-4777-8777-777777777777';
const MISSING_SOURCE_ID = '88888888-8888-4888-8888-888888888888';

function createRuntimeSource(sourceId: string, regionIds: readonly string[]): RuntimeAudioSource {
  return {
    metadata: {
      id: sourceId,
      fileName: 'source.wav',
      mimeType: 'audio/wav',
      byteLength: 4,
      durationSeconds: 1,
    },
    objectUrl: `blob:${sourceId}`,
    isCommitted: true,
    regionIds,
  };
}

function createTrackMap(): ReadonlyMap<string, TrackState> {
  return new Map([
    [
      TRACK_ID,
      {
        id: TRACK_ID,
        name: 'Track 1',
        volume: 1,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [
          {
            id: ATTACHED_REGION_ID,
            sourceId: ATTACHED_SOURCE_ID,
            startTime: 0,
            endTime: 1,
            sourceStartTime: 0,
            duration: 1,
            status: [],
          },
          {
            id: DETACHED_REGION_ID,
            sourceId: DETACHED_SOURCE_ID,
            startTime: 1,
            endTime: 2,
            sourceStartTime: 0,
            duration: 1,
            status: [],
          },
          {
            id: MISSING_REGION_ID,
            sourceId: MISSING_SOURCE_ID,
            startTime: 2,
            endTime: 3,
            sourceStartTime: 0,
            duration: 1,
            status: [],
          },
        ],
      },
    ],
  ]);
}

describe('Agent 프로젝트 컨텍스트', () => {
  it('등록 Source 존재와 Region 연결을 모두 확인해 사용 가능 여부를 계산한다', () => {
    const resolve = vi.fn((sourceId: string) => {
      if (sourceId === ATTACHED_SOURCE_ID) {
        return createRuntimeSource(sourceId, [ATTACHED_REGION_ID]);
      }
      if (sourceId === DETACHED_SOURCE_ID) {
        return createRuntimeSource(sourceId, []);
      }
      return null;
    });
    const resolver: IAudioSourceResolver = { resolve, listCommittedMetadata: () => [] };

    const promptTracks = createAgentPromptTracks(createTrackMap(), resolver);

    expect(promptTracks[0]?.name).toBe('Track 1');
    const promptRegions = promptTracks[0].regions;

    expect(promptRegions).toEqual([
      expect.objectContaining({ id: ATTACHED_REGION_ID, sourceId: ATTACHED_SOURCE_ID, hasAudioSource: true }),
      expect.objectContaining({ id: DETACHED_REGION_ID, sourceId: DETACHED_SOURCE_ID, hasAudioSource: false }),
      expect.objectContaining({ id: MISSING_REGION_ID, sourceId: MISSING_SOURCE_ID, hasAudioSource: false }),
    ]);
    expect(resolve).toHaveBeenCalledTimes(3);
  });

  it('Track에 설치된 Plugin instance와 Parameter 값을 복제한다', () => {
    const trackMap = createTrackMap();
    const track = trackMap.get(TRACK_ID);
    if (!track) {
      throw new Error('테스트 Track이 없습니다.');
    }
    track.pluginInstances.push({
      id: '55555555-5555-4555-8555-555555555555',
      manifestSummary: { id: 'builtin.gain', name: 'Gain', version: '1.0.0' },
      isEnabled: true,
      parameters: [{ id: 'gain', value: 0.75 }],
    });
    const resolver: IAudioSourceResolver = { resolve: () => null, listCommittedMetadata: () => [] };

    const promptTracks = createAgentPromptTracks(trackMap, resolver);

    expect(promptTracks[0].pluginInstances).toEqual(track.pluginInstances);
    expect(promptTracks[0].pluginInstances).not.toBe(track.pluginInstances);
    expect(promptTracks[0].pluginInstances[0].parameters).not.toBe(track.pluginInstances[0].parameters);
  });

  it('Session Plugin catalog를 Agent용 독립 객체로 복제한다', () => {
    const pluginCatalog = new Map([
      [
        'builtin.gain',
        {
          id: 'builtin.gain',
          name: 'Gain',
          version: '1.0.0',
          parameters: [
            {
              id: 'gain',
              name: 'Gain',
              type: 'number' as const,
              minValue: 0,
              maxValue: 2,
              defaultValue: 1,
              step: 0.01,
            },
          ],
        },
      ],
    ]);

    const promptPlugins = createAgentPromptPlugins(pluginCatalog);

    expect(promptPlugins).toEqual([pluginCatalog.get('builtin.gain')]);
    expect(promptPlugins[0]).not.toBe(pluginCatalog.get('builtin.gain'));
    expect(promptPlugins[0].parameters).not.toBe(pluginCatalog.get('builtin.gain')?.parameters);
  });
});
