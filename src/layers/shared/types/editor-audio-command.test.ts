import { describe, expect, it } from 'vitest';
import { AudioCommandSchema, AudioCommandType, StrictAudioCommandSchema } from './audioCommand.schema';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_REGION_ID = '33333333-3333-4333-8333-333333333333';
const CROSSFADE_ID = '44444444-4444-4444-8444-444444444444';

describe('편집 AudioCommand 계약', () => {
  it.each([
    {
      type: AudioCommandType.SET_EDITOR_SELECTION,
      editPointSeconds: 2,
      range: { endTimeSeconds: 4, startTimeSeconds: 1, trackIds: [TRACK_ID] },
      regions: [{ regionId: REGION_ID, trackId: TRACK_ID }],
      trackIds: [TRACK_ID],
    },
    { type: AudioCommandType.COPY_SELECTED_REGIONS },
    { type: AudioCommandType.CUT_SELECTED_REGIONS },
    { type: AudioCommandType.PASTE_REGIONS },
    { type: AudioCommandType.DUPLICATE_SELECTED_REGIONS, offsetSeconds: 2 },
    { type: AudioCommandType.NUDGE_SELECTED_REGIONS, deltaSeconds: -0.1 },
    { type: AudioCommandType.ALIGN_SELECTED_REGIONS, edge: 'start', targetTimeSeconds: 3 },
    {
      type: AudioCommandType.TRIM_REGION,
      durationSeconds: 2,
      regionId: REGION_ID,
      sourceStartTimeSeconds: 1,
      startTimeSeconds: 3,
      trackId: TRACK_ID,
    },
    {
      type: AudioCommandType.SLIP_REGION,
      regionId: REGION_ID,
      sourceStartTimeSeconds: 2,
      trackId: TRACK_ID,
    },
    {
      type: AudioCommandType.SET_REGION_PROCESSING,
      fadeIn: { curve: 'linear', durationSeconds: 0.25 },
      gain: 0.5,
      isOpaque: true,
      layer: 2,
      regionId: REGION_ID,
      trackId: TRACK_ID,
    },
    {
      type: AudioCommandType.CREATE_REGION_CROSSFADE,
      crossfadeId: CROSSFADE_ID,
      curve: 'equalPower',
      fadeInRegionId: SECOND_REGION_ID,
      fadeOutRegionId: REGION_ID,
      trackId: TRACK_ID,
    },
    {
      type: AudioCommandType.REMOVE_REGION_CROSSFADE,
      crossfadeId: CROSSFADE_ID,
      trackId: TRACK_ID,
    },
    { type: AudioCommandType.NORMALIZE_SELECTED_REGIONS, targetPeak: 0.9 },
    { type: AudioCommandType.REVERSE_SELECTED_REGIONS },
    {
      type: AudioCommandType.STRIP_SILENCE_SELECTED_REGIONS,
      minimumSilenceSeconds: 0.1,
      thresholdDb: -60,
    },
  ])('$type 명령을 허용한다', command => {
    expect(AudioCommandSchema.parse(command)).toEqual(command);
    expect(StrictAudioCommandSchema.parse(command)).toEqual(command);
  });

  it.each([
    { type: AudioCommandType.NUDGE_SELECTED_REGIONS, deltaSeconds: 0 },
    { type: AudioCommandType.DUPLICATE_SELECTED_REGIONS, offsetSeconds: 0 },
    {
      type: AudioCommandType.SET_EDITOR_SELECTION,
      editPointSeconds: 0,
      range: { endTimeSeconds: 1, startTimeSeconds: 1, trackIds: [TRACK_ID] },
      regions: [],
      trackIds: [],
    },
    {
      type: AudioCommandType.TRIM_REGION,
      durationSeconds: 0,
      regionId: REGION_ID,
      sourceStartTimeSeconds: 0,
      startTimeSeconds: 0,
      trackId: TRACK_ID,
    },
    {
      type: AudioCommandType.SET_REGION_PROCESSING,
      gain: -1,
      regionId: REGION_ID,
      trackId: TRACK_ID,
    },
    {
      type: AudioCommandType.SET_REGION_PROCESSING,
      regionId: REGION_ID,
      trackId: TRACK_ID,
    },
    { type: AudioCommandType.NORMALIZE_SELECTED_REGIONS, targetPeak: 0 },
    {
      type: AudioCommandType.STRIP_SILENCE_SELECTED_REGIONS,
      minimumSilenceSeconds: 0,
      thresholdDb: 1,
    },
  ])('$type의 무효 값을 거부한다', command => {
    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
  });
});
