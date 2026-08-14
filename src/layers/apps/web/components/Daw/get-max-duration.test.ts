import { describe, expect, it } from 'vitest';
import type { RegionState, TrackState } from '@/layers/session/session';
import { createDefaultRegionProcessingState } from '@/layers/shared/types/region-processing';
import { getMaxDuration } from './get-max-duration';

function createRegion(id: string, startTime: number, duration: number): RegionState {
  return {
    ...createDefaultRegionProcessingState(),
    id,
    sourceId: `source-${id}`,
    startTime,
    endTime: startTime + duration,
    sourceStartTime: 0,
    duration,
    status: [],
  };
}

function createTrack(id: string, regions: RegionState[]): TrackState {
  return {
    id,
    name: id,
    volume: 1,
    pan: 0,
    isMuted: false,
    isSoloed: false,
    status: [],
    pluginInstances: [],
    regions,
  };
}

describe('getMaxDuration', () => {
  it('Session Region의 시작 시각과 길이로 가장 늦은 끝 시각을 계산한다', () => {
    const tracks = [
      createTrack('track-1', [createRegion('region-1', 2, 3), createRegion('region-2', 12, 2)]),
      createTrack('track-2', [createRegion('region-3', 7, 4)]),
      createTrack('track-3', []),
    ];

    expect(getMaxDuration(tracks)).toBe(14);
  });

  it('Track이 없으면 0을 반환한다', () => {
    expect(getMaxDuration([])).toBe(0);
  });

  it('MIDI Region의 시작 시각과 길이도 포함한다', () => {
    const midiTrack: TrackState = {
      ...createTrack('midi-track', []),
      midi: {
        instrumentId: 'builtin.poly-synth',
        regions: [
          {
            durationSeconds: 3,
            id: '11111111-1111-4111-8111-111111111111',
            name: 'MIDI Region',
            notes: [],
            startTimeSeconds: 12,
          },
        ],
      },
    };

    expect(getMaxDuration([midiTrack])).toBe(15);
  });
});
