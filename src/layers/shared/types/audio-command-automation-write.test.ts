import { describe, expect, it } from 'vitest';
import { AudioCommandSchema, AudioCommandType } from './audioCommand.schema';

const BASE_COMMAND = {
  laneId: '11111111-1111-4111-8111-111111111111',
  passRange: { endTimeSeconds: 3, startTimeSeconds: 1 },
  samples: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      interpolation: 'linear' as const,
      timeSeconds: 1,
      value: 0.25,
    },
    {
      id: '44444444-4444-4444-8444-444444444444',
      interpolation: 'linear' as const,
      timeSeconds: 2,
      value: 0.75,
    },
  ],
  trackId: '22222222-2222-4222-8222-222222222222',
};

describe('Automation write pass 명령 계약', () => {
  it.each([AudioCommandType.PREVIEW_AUTOMATION_WRITE_PASS, AudioCommandType.COMMIT_AUTOMATION_WRITE_PASS])(
    '%s 명령을 검증한다',
    type => {
      expect(AudioCommandSchema.parse({ ...BASE_COMMAND, type })).toEqual({ ...BASE_COMMAND, type });
    }
  );

  it('sample 시간이 증가하지 않으면 거부한다', () => {
    const samples = [BASE_COMMAND.samples[1], BASE_COMMAND.samples[0]];

    expect(
      AudioCommandSchema.safeParse({ ...BASE_COMMAND, samples, type: AudioCommandType.COMMIT_AUTOMATION_WRITE_PASS })
        .success
    ).toBe(false);
  });

  it('sample이 pass 범위를 벗어나면 거부한다', () => {
    const samples = [{ ...BASE_COMMAND.samples[0], timeSeconds: 0.5 }];

    expect(
      AudioCommandSchema.safeParse({ ...BASE_COMMAND, samples, type: AudioCommandType.PREVIEW_AUTOMATION_WRITE_PASS })
        .success
    ).toBe(false);
  });
});
