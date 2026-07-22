import { describe, expect, it, vi } from 'vitest';
import type { AudioFile } from '@/types/audioFile';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import {
  createTrackRegionImportCommand,
  executeTrackRegionImport,
  type ConvertedAudioFile,
} from './track-region-import-command';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const AUDIO_URL = 'blob:https://example.com/33333333-3333-4333-8333-333333333333';

function createAudioFile(): AudioFile {
  return {
    file: new File(['audio'], 'voice.wav', { type: 'audio/wav' }),
    name: 'voice.wav',
    size: 5,
    formattedSize: '5 B',
    type: 'audio/wav',
    duration: 3.5,
    formattedDuration: '0:04',
    url: AUDIO_URL,
  };
}

function createConvertedAudioFile(): ConvertedAudioFile {
  return {
    audioFile: createAudioFile(),
    url: AUDIO_URL,
  };
}

describe('기존 Track Region 가져오기 명령', () => {
  it('선택한 Track과 현재 시각으로 정확한 LOAD_REGION 명령을 만든다', () => {
    expect(
      createTrackRegionImportCommand({
        trackId: TRACK_ID,
        regionId: REGION_ID,
        url: AUDIO_URL,
        startTime: 12.25,
        duration: 3.5,
      })
    ).toEqual({
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      url: AUDIO_URL,
      startTime: 12.25,
      startOffset: 0,
      duration: 3.5,
    });
  });

  it('Region 등록 성공 뒤에 오디오 파일을 Session에 보관한다', async () => {
    const convertedAudioFile = createConvertedAudioFile();
    const executeCommand = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);
    const registerAudioFile = vi.fn();

    const result = await executeTrackRegionImport({
      file: convertedAudioFile.audioFile.file,
      trackId: TRACK_ID,
      startTime: 12.25,
      createRegionId: () => REGION_ID,
      convertAudioFile: vi.fn().mockResolvedValue(convertedAudioFile),
      executeCommand,
      registerAudioFile,
      releaseAudioUrl: vi.fn(),
      notifyFailure: vi.fn(),
    });

    expect(result).toBe('imported');
    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(
      createTrackRegionImportCommand({
        trackId: TRACK_ID,
        regionId: REGION_ID,
        url: AUDIO_URL,
        startTime: 12.25,
        duration: 3.5,
      })
    );
    expect(registerAudioFile).toHaveBeenCalledWith(AUDIO_URL, convertedAudioFile.audioFile);
    expect(executeCommand.mock.invocationCallOrder[0]).toBeLessThan(registerAudioFile.mock.invocationCallOrder[0]);
  });

  it('파일 변환 결과가 없으면 명령을 실행하지 않는다', async () => {
    const executeCommand = vi.fn();
    const registerAudioFile = vi.fn();
    const notifyFailure = vi.fn();

    const result = await executeTrackRegionImport({
      file: createAudioFile().file,
      trackId: TRACK_ID,
      startTime: 0,
      createRegionId: () => REGION_ID,
      convertAudioFile: vi.fn().mockResolvedValue(null),
      executeCommand,
      registerAudioFile,
      releaseAudioUrl: vi.fn(),
      notifyFailure,
    });

    expect(result).toBe('invalid-file');
    expect(executeCommand).not.toHaveBeenCalled();
    expect(registerAudioFile).not.toHaveBeenCalled();
    expect(notifyFailure).toHaveBeenCalledWith('오디오 파일을 읽지 못했습니다.');
  });

  it('길이를 확인할 수 없는 파일은 Region으로 등록하지 않고 Blob URL을 해제한다', async () => {
    const convertedAudioFile = createConvertedAudioFile();
    convertedAudioFile.audioFile.duration = undefined;
    const executeCommand = vi.fn();
    const releaseAudioUrl = vi.fn();
    const notifyFailure = vi.fn();

    const result = await executeTrackRegionImport({
      file: convertedAudioFile.audioFile.file,
      trackId: TRACK_ID,
      startTime: 0,
      createRegionId: () => REGION_ID,
      convertAudioFile: vi.fn().mockResolvedValue(convertedAudioFile),
      executeCommand,
      registerAudioFile: vi.fn(),
      releaseAudioUrl,
      notifyFailure,
    });

    expect(result).toBe('invalid-file');
    expect(executeCommand).not.toHaveBeenCalled();
    expect(releaseAudioUrl).toHaveBeenCalledWith(AUDIO_URL);
    expect(notifyFailure).toHaveBeenCalledWith('오디오 길이를 확인하지 못했습니다.');
  });

  it('명령 실행 실패 시 사용하지 못한 Blob URL을 해제하고 원인을 알린다', async () => {
    const convertedAudioFile = createConvertedAudioFile();
    const releaseAudioUrl = vi.fn();
    const registerAudioFile = vi.fn();
    const notifyFailure = vi.fn();

    const result = await executeTrackRegionImport({
      file: convertedAudioFile.audioFile.file,
      trackId: TRACK_ID,
      startTime: 0,
      createRegionId: () => REGION_ID,
      convertAudioFile: vi.fn().mockResolvedValue(convertedAudioFile),
      executeCommand: vi.fn().mockRejectedValue(new Error('디코딩 오류')),
      registerAudioFile,
      releaseAudioUrl,
      notifyFailure,
    });

    expect(result).toBe('failed');
    expect(registerAudioFile).not.toHaveBeenCalled();
    expect(releaseAudioUrl).toHaveBeenCalledWith(AUDIO_URL);
    expect(notifyFailure).toHaveBeenCalledWith('Region을 추가하지 못했습니다: 디코딩 오류');
  });
});
