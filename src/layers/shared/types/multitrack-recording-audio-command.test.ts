import { describe, expect, it } from 'vitest';
import { AudioCommandSchema, AudioCommandType, StrictAudioCommandSchema } from './audioCommand.schema';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const PLAYLIST_ID = '22222222-2222-4222-8222-222222222222';
const TAKE_ID = '33333333-3333-4333-8333-333333333333';
const SEGMENT_ID = '44444444-4444-4444-8444-444444444444';

describe('Multitrack 녹음 AudioCommand', () => {
  it.each([
    {
      channelIndex: 1,
      deviceId: 'input-device',
      trackId: TRACK_ID,
      type: AudioCommandType.SET_TRACK_RECORDING_INPUT,
    },
    {
      isEnabled: true,
      range: { endTimeSeconds: 8, startTimeSeconds: 4 },
      type: AudioCommandType.SET_PUNCH_RECORDING,
    },
    { recordMode: 'soundOnSound', trackId: TRACK_ID, type: AudioCommandType.SET_TRACK_RECORD_MODE },
    { playlistId: PLAYLIST_ID, takeId: TAKE_ID, trackId: TRACK_ID, type: AudioCommandType.SELECT_TAKE },
    {
      compSegments: [{ endTimeSeconds: 4, id: SEGMENT_ID, startTimeSeconds: 2, takeId: TAKE_ID }],
      playlistId: PLAYLIST_ID,
      trackId: TRACK_ID,
      type: AudioCommandType.SET_COMP_SEGMENTS,
    },
  ])('$type 정상값을 허용한다', command => {
    expect(AudioCommandSchema.parse(command)).toEqual(command);
    expect(StrictAudioCommandSchema.parse(command)).toEqual(command);
  });

  it.each([
    {
      channelIndex: -1,
      deviceId: null,
      trackId: TRACK_ID,
      type: AudioCommandType.SET_TRACK_RECORDING_INPUT,
    },
    { isEnabled: true, range: null, type: AudioCommandType.SET_PUNCH_RECORDING },
    {
      isEnabled: false,
      range: { endTimeSeconds: 2, startTimeSeconds: 2 },
      type: AudioCommandType.SET_PUNCH_RECORDING,
    },
    { recordMode: 'replace', trackId: TRACK_ID, type: AudioCommandType.SET_TRACK_RECORD_MODE },
    {
      compSegments: [{ endTimeSeconds: 2, id: SEGMENT_ID, startTimeSeconds: 3, takeId: TAKE_ID }],
      playlistId: PLAYLIST_ID,
      trackId: TRACK_ID,
      type: AudioCommandType.SET_COMP_SEGMENTS,
    },
  ])('$type 잘못된 값을 거부한다', command => {
    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
    expect(StrictAudioCommandSchema.safeParse(command).success).toBe(false);
  });
});
