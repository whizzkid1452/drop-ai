import { describe, expect, it } from 'vitest';
import { AudioCommandType, StrictAudioCommandSchema } from './audioCommand.schema';

describe('SET_AUTOMATION_LANES 계약', () => {
  it('정렬된 Automation point 목록을 허용한다', () => {
    const command = {
      automationLanes: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          isEnabled: true,
          points: [
            {
              id: '22222222-2222-4222-8222-222222222222',
              interpolation: 'linear',
              timeSeconds: 0,
              value: 0.5,
            },
          ],
          target: { kind: 'trackVolume' },
        },
      ],
      trackId: '33333333-3333-4333-8333-333333333333',
      type: AudioCommandType.SET_AUTOMATION_LANES,
    };

    expect(StrictAudioCommandSchema.parse(command)).toEqual(command);
  });
});
