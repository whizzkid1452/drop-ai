import { describe, expect, it } from 'vitest';
import { AudioCommandSchema, AudioCommandType } from './audioCommand.schema';

const TRACK_ID = '550e8400-e29b-41d4-a716-446655440000';
const REGION_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';

describe('AudioCommandSchema 프로젝트 변경 명령', () => {
  it.each([
    { type: AudioCommandType.SET_TEMPO, tempo: 120 },
    { type: AudioCommandType.REMOVE_TRACK, trackId: TRACK_ID },
    { type: AudioCommandType.SET_TRACK_MUTE, trackId: TRACK_ID, muted: true },
    { type: AudioCommandType.SET_TRACK_SOLO, trackId: TRACK_ID, soloed: false },
    {
      type: AudioCommandType.SPLIT_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      splitTime: 2.5,
    },
    {
      type: AudioCommandType.MOVE_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      newStartTime: 4,
    },
  ])('$type 정상값을 허용한다', command => {
    expect(AudioCommandSchema.safeParse(command).success).toBe(true);
  });

  it.each([
    {
      type: AudioCommandType.SPLIT_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      splitTime: 0,
    },
    {
      type: AudioCommandType.MOVE_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      newStartTime: 0,
    },
  ])('$type의 시간축 값 0을 허용한다', command => {
    expect(AudioCommandSchema.safeParse(command).success).toBe(true);
  });

  it.each([
    { type: AudioCommandType.SET_TEMPO, tempo: 0 },
    { type: AudioCommandType.SET_TEMPO, tempo: -1 },
    {
      type: AudioCommandType.SPLIT_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      splitTime: -0.001,
    },
    {
      type: AudioCommandType.MOVE_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      newStartTime: -0.001,
    },
  ])('$type의 범위를 벗어난 숫자를 거부한다', command => {
    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
  });

  it.each([
    { type: AudioCommandType.REMOVE_TRACK, trackId: 'track-1' },
    { type: AudioCommandType.SET_TRACK_MUTE, trackId: 'track-1', muted: true },
    { type: AudioCommandType.SET_TRACK_SOLO, trackId: 'track-1', soloed: true },
    {
      type: AudioCommandType.SPLIT_REGION,
      trackId: 'track-1',
      regionId: REGION_ID,
      splitTime: 1,
    },
    {
      type: AudioCommandType.SPLIT_REGION,
      trackId: TRACK_ID,
      regionId: 'region-1',
      splitTime: 1,
    },
    {
      type: AudioCommandType.MOVE_REGION,
      trackId: 'track-1',
      regionId: REGION_ID,
      newStartTime: 1,
    },
    {
      type: AudioCommandType.MOVE_REGION,
      trackId: TRACK_ID,
      regionId: 'region-1',
      newStartTime: 1,
    },
  ])('$type의 잘못된 UUID를 거부한다', command => {
    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
  });

  it.each([
    { type: AudioCommandType.SET_TRACK_MUTE, trackId: TRACK_ID, muted: 'true' },
    { type: AudioCommandType.SET_TRACK_SOLO, trackId: TRACK_ID, soloed: 1 },
  ])('$type의 boolean이 아닌 상태값을 거부한다', command => {
    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
  });

  it.each([
    { type: AudioCommandType.REMOVE_TRACK },
    { type: AudioCommandType.SET_TEMPO },
    { type: AudioCommandType.SET_TRACK_MUTE, trackId: TRACK_ID },
    { type: AudioCommandType.SET_TRACK_SOLO, trackId: TRACK_ID },
    {
      type: AudioCommandType.SPLIT_REGION,
      trackId: TRACK_ID,
      splitTime: 1,
    },
    {
      type: AudioCommandType.MOVE_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
    },
  ])('$type의 필수 필드 누락을 거부한다', command => {
    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
  });

  it.each([
    { type: AudioCommandType.SET_TEMPO, tempo: '120' },
    {
      type: AudioCommandType.SPLIT_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      splitTime: '1',
    },
    {
      type: AudioCommandType.MOVE_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      newStartTime: '1',
    },
  ])('$type의 문자열 숫자를 거부한다', command => {
    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
  });
});
