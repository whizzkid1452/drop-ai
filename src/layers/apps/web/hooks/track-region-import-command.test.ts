import { describe, expect, it, vi } from 'vitest';
import { AudioImportCompensationError } from '@/layers/apps/web/audio-import-errors';
import type { AudioFileMetadata } from '@/utils/audio/convert-file-to-audio-file';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import type { StagedWebAudioSource } from './stage-web-audio-source';
import { createTrackRegionImportCommand, executeTrackRegionImport } from './track-region-import-command';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_ID = '33333333-3333-4333-8333-333333333333';
function createAudioFileMetadata(duration: number | undefined = 3.5): AudioFileMetadata {
  const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });

  return {
    file,
    name: file.name,
    size: file.size,
    formattedSize: '5 B',
    type: file.type,
    duration,
    formattedDuration: duration === undefined ? undefined : '0:04',
    volume: 1,
  };
}

function createStagedAudioSource(audioFileMetadata = createAudioFileMetadata()): StagedWebAudioSource {
  return {
    sourceId: SOURCE_ID,
    audioFile: audioFileMetadata,
  };
}

function createExecutionOptions(overrides: Record<string, unknown> = {}) {
  const audioFileMetadata = createAudioFileMetadata();
  const stagedAudioSource = createStagedAudioSource(audioFileMetadata);

  return {
    file: audioFileMetadata.file,
    trackId: TRACK_ID,
    startTime: 12.25,
    createRegionId: () => REGION_ID,
    convertAudioFile: vi.fn().mockResolvedValue(audioFileMetadata),
    stageAudioSource: vi.fn().mockReturnValue(stagedAudioSource),
    discardPendingSource: vi.fn(),
    executeCommand: vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined),
    notifyFailure: vi.fn(),
    ...overrides,
  };
}

describe('기존 Track Region 가져오기 명령', () => {
  it('선택한 Track과 현재 시각을 sourceId 기반 LOAD_REGION 명령으로 만든다', () => {
    expect(
      createTrackRegionImportCommand({
        trackId: TRACK_ID,
        regionId: REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 12.25,
        duration: 3.5,
      })
    ).toEqual({
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      sourceId: SOURCE_ID,
      startTime: 12.25,
      startOffset: 0,
      duration: 3.5,
    });
  });

  it('길이 검증 후 Source를 stage하고 Region을 등록한다', async () => {
    const options = createExecutionOptions();

    const result = await executeTrackRegionImport(options);

    expect(result).toBe('imported');
    expect(options.stageAudioSource).toHaveBeenCalledWith(await options.convertAudioFile.mock.results[0].value);
    expect(options.executeCommand).toHaveBeenCalledWith(
      createTrackRegionImportCommand({
        trackId: TRACK_ID,
        regionId: REGION_ID,
        sourceId: SOURCE_ID,
        startTime: 12.25,
        duration: 3.5,
      })
    );
    expect(options.discardPendingSource).not.toHaveBeenCalled();
    expect(options.notifyFailure).not.toHaveBeenCalled();
    expect(options.stageAudioSource.mock.invocationCallOrder[0]).toBeLessThan(
      options.executeCommand.mock.invocationCallOrder[0]
    );
  });

  it('파일 변환 결과가 없으면 Source를 stage하지 않는다', async () => {
    const options = createExecutionOptions({ convertAudioFile: vi.fn().mockResolvedValue(null) });

    const result = await executeTrackRegionImport(options);

    expect(result).toBe('invalid-file');
    expect(options.stageAudioSource).not.toHaveBeenCalled();
    expect(options.executeCommand).not.toHaveBeenCalled();
    expect(options.notifyFailure).toHaveBeenCalledWith('오디오 파일을 읽지 못했습니다.');
  });

  it.each([undefined, 0, -1, Number.POSITIVE_INFINITY])(
    '길이가 %s이면 Source를 stage하기 전에 거부한다',
    async duration => {
      const audioFileMetadata = createAudioFileMetadata();
      audioFileMetadata.duration = duration;
      const options = createExecutionOptions({
        file: audioFileMetadata.file,
        convertAudioFile: vi.fn().mockResolvedValue(audioFileMetadata),
      });

      const result = await executeTrackRegionImport(options);

      expect(result).toBe('invalid-file');
      expect(options.stageAudioSource).not.toHaveBeenCalled();
      expect(options.executeCommand).not.toHaveBeenCalled();
      expect(options.discardPendingSource).not.toHaveBeenCalled();
      expect(options.notifyFailure).toHaveBeenCalledWith('오디오 길이를 확인하지 못했습니다.');
    }
  );

  it('Source stage가 실패하면 존재 여부가 불명확한 Source를 discard하지 않는다', async () => {
    const stageFailure = new Error('Source 준비 오류');
    const options = createExecutionOptions({
      stageAudioSource: vi.fn(() => {
        throw stageFailure;
      }),
    });

    const result = await executeTrackRegionImport(options);

    expect(result).toBe('failed');
    expect(options.executeCommand).not.toHaveBeenCalled();
    expect(options.discardPendingSource).not.toHaveBeenCalled();
    expect(options.notifyFailure).toHaveBeenCalledWith(
      '오디오 Source를 준비하지 못했습니다. Source 준비 오류',
      stageFailure
    );
  });

  it('stage 뒤 명령 생성이 실패하면 pending Source를 discard한다', async () => {
    const commandCreationFailure = new Error('Region ID 생성 오류');
    const options = createExecutionOptions({
      createRegionId: () => {
        throw commandCreationFailure;
      },
    });

    const result = await executeTrackRegionImport(options);

    expect(result).toBe('failed');
    expect(options.executeCommand).not.toHaveBeenCalled();
    expect(options.discardPendingSource).toHaveBeenCalledWith(SOURCE_ID);
    expect(options.notifyFailure).toHaveBeenCalledWith(
      'Region을 추가하지 못했습니다. Region ID 생성 오류',
      commandCreationFailure
    );
  });

  it('명령 실행이 실패하면 Controller 정리 여부와 무관하게 discardPending을 호출한다', async () => {
    const commandFailure = new Error('디코더 오류');
    const options = createExecutionOptions({ executeCommand: vi.fn().mockRejectedValue(commandFailure) });

    const result = await executeTrackRegionImport(options);

    expect(result).toBe('failed');
    expect(options.discardPendingSource).toHaveBeenCalledWith(SOURCE_ID);
    expect(options.notifyFailure).toHaveBeenCalledWith('Region을 추가하지 못했습니다. 디코더 오류', commandFailure);
  });

  it('명령 오류와 pending Source discard 오류를 구조화된 오류에 함께 보존한다', async () => {
    const commandFailure = new Error('명령 오류');
    const discardFailure = new Error('Source 정리 오류');
    const notifyFailure = vi.fn();
    const options = createExecutionOptions({
      executeCommand: vi.fn().mockRejectedValue(commandFailure),
      discardPendingSource: vi.fn(() => {
        throw discardFailure;
      }),
      notifyFailure,
    });

    const result = await executeTrackRegionImport(options);

    expect(result).toBe('failed');
    expect(notifyFailure).toHaveBeenCalledTimes(1);
    const [, notifiedError] = notifyFailure.mock.calls[0];
    expect(notifiedError).toBeInstanceOf(AudioImportCompensationError);
    expect(notifiedError).toMatchObject({
      operation: 'track-region-import',
      failedPhase: 'LOAD_REGION 실행',
      cause: commandFailure,
      compensationFailures: [{ step: 'pending Source 정리', cause: discardFailure }],
    });
    expect(notifyFailure).toHaveBeenCalledWith(
      'Region을 추가하지 못했습니다. 명령 오류 pending Source 정리도 실패했습니다: Source 정리 오류',
      notifiedError
    );
  });
});
