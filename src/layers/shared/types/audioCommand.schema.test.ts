import { describe, expect, it } from 'vitest';
import {
  AudioCommandSchema,
  AudioCommandType,
  parseAudioCommandString,
  parseAgentAudioCommandBatch,
  StrictAudioCommandSchema,
} from './audioCommand.schema';

const TRACK_ID = '550e8400-e29b-41d4-a716-446655440000';
const REGION_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const SOURCE_ID = '11111111-1111-4111-8111-111111111111';

describe('ADD_TRACK 계약', () => {
  it('Track ID만으로 빈 Track 생성 명령을 허용한다', () => {
    const command = {
      type: AudioCommandType.ADD_TRACK,
      trackId: TRACK_ID,
    };

    expect(AudioCommandSchema.parse(command)).toEqual(command);
    expect(StrictAudioCommandSchema.parse(command)).toEqual(command);
  });

  it('Agent 명령의 URL 필드를 거부한다', () => {
    expect(
      StrictAudioCommandSchema.safeParse({
        type: AudioCommandType.ADD_TRACK,
        trackId: TRACK_ID,
        url: 'https://example.com/audio.wav',
      }).success
    ).toBe(false);
  });

  it('일반 명령의 이전 URL 필드는 제거하고 빈 Track 생성으로 해석한다', () => {
    expect(
      AudioCommandSchema.parse({
        type: AudioCommandType.ADD_TRACK,
        trackId: TRACK_ID,
        url: 'https://example.com/audio.wav',
      })
    ).toEqual({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });
  });
});

describe('LOAD_REGION 오디오 식별자 계약', () => {
  it('sourceId를 보존한다', () => {
    const command = {
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      sourceId: SOURCE_ID,
      startTime: 0,
    };

    expect(AudioCommandSchema.parse(command)).toEqual(command);
    expect(StrictAudioCommandSchema.parse(command)).toEqual(command);
  });

  it('기존 clone 명령을 위해 url과 sourceId가 모두 없는 값을 허용한다', () => {
    const command = {
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      startTime: 0,
    };

    expect(AudioCommandSchema.safeParse(command).success).toBe(true);
    expect(StrictAudioCommandSchema.safeParse(command).success).toBe(true);
  });

  it('기존 url 기반 명령을 일반 Schema와 Agent Schema에서 모두 거부한다', () => {
    const command = {
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      url: 'blob:test-audio',
      startTime: 0,
    };

    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
    expect(StrictAudioCommandSchema.safeParse(command).success).toBe(false);
  });

  it('url과 sourceId를 함께 전달해도 거부한다', () => {
    const command = {
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      url: 'blob:test-audio',
      sourceId: SOURCE_ID,
      startTime: 0,
    };

    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
    expect(StrictAudioCommandSchema.safeParse(command).success).toBe(false);
  });

  it('잘못된 sourceId를 거부한다', () => {
    const command = {
      type: AudioCommandType.LOAD_REGION,
      sourceId: 'source-1',
      startTime: 0,
    };

    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
    expect(StrictAudioCommandSchema.safeParse(command).success).toBe(false);
  });

  it('시작과 길이의 합이 유한수가 아닌 명령을 거부한다', () => {
    const command = {
      type: AudioCommandType.LOAD_REGION,
      sourceId: SOURCE_ID,
      startTime: Number.MAX_VALUE,
      startOffset: 0,
      duration: Number.MAX_VALUE,
    };

    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
    expect(StrictAudioCommandSchema.safeParse(command).success).toBe(false);
  });

  it('원본 시작과 길이의 합이 유한수가 아닌 명령을 거부한다', () => {
    const command = {
      type: AudioCommandType.LOAD_REGION,
      sourceId: SOURCE_ID,
      startTime: 0,
      startOffset: Number.MAX_VALUE,
      duration: Number.MAX_VALUE,
    };

    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
    expect(StrictAudioCommandSchema.safeParse(command).success).toBe(false);
  });
});

describe('AudioCommandSchema 프로젝트 변경 명령', () => {
  it.each([
    { type: AudioCommandType.UNDO },
    { type: AudioCommandType.REDO },
    { type: AudioCommandType.SAVE_PROJECT },
    { type: AudioCommandType.LOAD_PROJECT, projectId: TRACK_ID },
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
    { type: AudioCommandType.LOAD_PROJECT, projectId: 'project-1' },
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
    { type: AudioCommandType.LOAD_PROJECT },
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

  it('기존 Command Schema는 호환성을 위해 추가 필드를 제거한다', () => {
    expect(
      AudioCommandSchema.parse({
        type: AudioCommandType.EXPORT_AUDIO,
        startTime: 1,
      })
    ).toEqual({ type: AudioCommandType.EXPORT_AUDIO });
  });

  it('Agent용 Command Schema는 정의되지 않은 필드를 거부한다', () => {
    expect(
      StrictAudioCommandSchema.safeParse({
        type: AudioCommandType.EXPORT_AUDIO,
        startTime: 1,
      }).success
    ).toBe(false);
  });

  it('SAVE_PROJECT는 추가 필드가 없는 명령만 Agent에서 허용한다', () => {
    expect(StrictAudioCommandSchema.parse({ type: AudioCommandType.SAVE_PROJECT })).toEqual({
      type: AudioCommandType.SAVE_PROJECT,
    });
    expect(
      StrictAudioCommandSchema.safeParse({
        type: AudioCommandType.SAVE_PROJECT,
        revision: 1,
      }).success
    ).toBe(false);
  });
});

describe('SET_EXPORT_RANGE 계약', () => {
  it('드래그 시작 상태인 길이 0 범위를 허용한다', () => {
    const command = { type: AudioCommandType.SET_EXPORT_RANGE, startTime: 2, endTime: 2 };

    expect(AudioCommandSchema.safeParse(command).success).toBe(true);
    expect(StrictAudioCommandSchema.safeParse(command).success).toBe(true);
  });

  it('끝이 시작보다 이른 범위를 일반·Agent Schema에서 거부한다', () => {
    const command = { type: AudioCommandType.SET_EXPORT_RANGE, startTime: 8, endTime: 2 };

    expect(AudioCommandSchema.safeParse(command).success).toBe(false);
    expect(StrictAudioCommandSchema.safeParse(command).success).toBe(false);
  });
});

describe('Agent AudioCommand 묶음 파싱', () => {
  it('SAVE_PROJECT 응답을 공통 명령으로 보존한다', () => {
    expect(
      parseAgentAudioCommandBatch({
        commandString: '[{"type":"SAVE_PROJECT"}]',
      })
    ).toEqual({ commands: [{ type: AudioCommandType.SAVE_PROJECT }] });
  });

  it('유효한 JSON 배열의 명령 순서를 보존한다', () => {
    const result = parseAgentAudioCommandBatch({
      commandString: '[{"type":"SET_TEMPO","tempo":140},{"type":"PLAY"}]',
    });

    expect(result).toEqual({
      commands: [{ type: AudioCommandType.SET_TEMPO, tempo: 140 }, { type: AudioCommandType.PLAY }],
    });
  });

  it('명령이 필요 없는 Agent 응답으로 빈 배열을 허용한다', () => {
    expect(parseAgentAudioCommandBatch({ commandString: '[]' })).toEqual({ commands: [] });
  });

  it('유효하지 않은 명령이 섞인 배열 전체를 거부한다', () => {
    const result = parseAgentAudioCommandBatch({
      commandString: '[{"type":"PLAY"},{"type":"SET_TEMPO","tempo":0}]',
    });

    expect(result.commands).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('알 수 없는 명령이 섞인 배열 전체를 거부한다', () => {
    const result = parseAgentAudioCommandBatch({
      commandString: '[{"type":"PLAY"},{"type":"DELETE_EVERYTHING"}]',
    });

    expect(result.commands).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('명령에 추가 필드가 있는 배열 전체를 거부한다', () => {
    const result = parseAgentAudioCommandBatch({
      commandString: '[{"type":"EXPORT_AUDIO","startTime":1}]',
    });

    expect(result.commands).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('배열이 아닌 단일 명령 객체를 거부한다', () => {
    const result = parseAgentAudioCommandBatch({ commandString: '{"type":"PLAY"}' });

    expect(result.commands).toBeNull();
    expect(result.error).toBeDefined();
  });

  it.each(['null', '1', '"PLAY"'])('배열이 아닌 JSON 값 %s을 예외 없이 거부한다', commandString => {
    const result = parseAgentAudioCommandBatch({ commandString });

    expect(result.commands).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('잘못된 JSON을 예외 없이 거부한다', () => {
    const result = parseAgentAudioCommandBatch({ commandString: '[{"type":"PLAY"}' });

    expect(result.commands).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('문자열 숫자를 number로 변환하지 않는다', () => {
    const result = parseAgentAudioCommandBatch({
      commandString: '[{"type":"SET_TEMPO","tempo":"140"}]',
    });

    expect(result.commands).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('JSON 밖에 설명 문장이 있는 응답을 거부한다', () => {
    const result = parseAgentAudioCommandBatch({ commandString: '실행합니다: [{"type":"PLAY"}]' });

    expect(result.commands).toBeNull();
    expect(result.error).toBeDefined();
  });
});

describe('Web JSON CLI 호환 파싱', () => {
  it('SAVE_PROJECT를 저장 명령으로 파싱한다', () => {
    expect(parseAudioCommandString({ commandString: '[{"type":"SAVE_PROJECT"}]' })).toEqual({
      commands: [{ type: AudioCommandType.SAVE_PROJECT }],
    });
  });

  it('단일 명령 객체를 허용한다', () => {
    expect(parseAudioCommandString({ commandString: '{"type":"PLAY"}' }).commands).toEqual([
      { type: AudioCommandType.PLAY },
    ]);
  });

  it('설명문 안의 단일 명령 객체를 추출한다', () => {
    expect(parseAudioCommandString({ commandString: '실행: {"type":"PLAY"}' }).commands).toEqual([
      { type: AudioCommandType.PLAY },
    ]);
  });

  it('배열의 유효하지 않은 항목과 null을 건너뛰고 유효한 명령을 반환한다', () => {
    const result = parseAudioCommandString({
      commandString: '[null,{"type":"SET_TEMPO","tempo":0},{"type":"PLAY"}]',
    });

    expect(result.commands).toEqual([{ type: AudioCommandType.PLAY }]);
  });

  it('기존 호환 규칙에 따라 추가 필드를 제거한다', () => {
    const result = parseAudioCommandString({
      commandString: '[{"type":"EXPORT_AUDIO","unexpected":true}]',
    });

    expect(result.commands).toEqual([{ type: AudioCommandType.EXPORT_AUDIO }]);
  });

  it('기존 url 기반 LOAD_REGION을 Source 재사용 명령으로 바꾸지 않고 거부한다', () => {
    const result = parseAudioCommandString({
      commandString:
        '[{"type":"LOAD_REGION","trackId":"550e8400-e29b-41d4-a716-446655440000","url":"blob:test-audio","startTime":0}]',
    });

    expect(result.commands).toBeNull();
    expect(result.error).toBeDefined();
  });
});
