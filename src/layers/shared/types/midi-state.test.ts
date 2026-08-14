import { describe, expect, it } from 'vitest';
import { cloneMidiTrackState, type MidiTrackState } from './midi-state';

describe('cloneMidiTrackState', () => {
  it('MIDI 제어 포인트까지 새 객체로 복제한다', () => {
    const midi: MidiTrackState = {
      instrumentId: 'builtin.poly-synth',
      recordMode: 'overdub',
      regions: [
        {
          controlLanes: [
            {
              channel: 1,
              controllerNumber: 74,
              id: '11111111-1111-4111-8111-111111111111',
              points: [
                {
                  id: '22222222-2222-4222-8222-222222222222',
                  timeOffsetSeconds: 0.5,
                  value: 96,
                },
              ],
              type: 'controlChange',
            },
          ],
          durationSeconds: 2,
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Verse',
          notes: [],
          startTimeSeconds: 0,
        },
      ],
    };

    const clone = cloneMidiTrackState(midi);

    expect(clone).toEqual(midi);
    expect(clone).not.toBe(midi);
    expect(clone.regions[0]).not.toBe(midi.regions[0]);
    expect(clone.regions[0]?.controlLanes[0]).not.toBe(midi.regions[0]?.controlLanes[0]);
    expect(clone.regions[0]?.controlLanes[0]?.points[0]).not.toBe(midi.regions[0]?.controlLanes[0]?.points[0]);
  });
});
