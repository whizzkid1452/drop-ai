import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IAudioSourceStager } from '@/layers/audio-source-registry/i-audio-source-registry';
import { AudioImportCompensationError } from '@/layers/apps/web/audio-import-errors';
import {
  CommandBatchExecutionError,
  type CommandBatchExecutionResult,
  type CommandExecutionResult,
  type CommandExecutor,
} from '@/layers/commands/command-executor';
import type { StagedWebAudioSource } from '@/layers/apps/web/hooks/stage-web-audio-source';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { createAudioImportCommands } from './audio-import-commands';
import { executeAudioFileImport } from './execute-audio-file-import';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_ID = '33333333-3333-4333-8333-333333333333';
const OBJECT_URL = 'blob:https://example.com/audio';

const execute = vi.fn<(command: AudioCommand) => Promise<CommandExecutionResult>>();
const executeMany = vi.fn<(commands: readonly AudioCommand[]) => Promise<CommandBatchExecutionResult>>();
const discardPending = vi.fn<IAudioSourceStager['discardPending']>();
const commandExecutor: Pick<CommandExecutor, 'execute' | 'executeMany'> = { execute, executeMany };
const audioSourceStager: Pick<IAudioSourceStager, 'discardPending'> = { discardPending };

function createStagedSource(): StagedWebAudioSource {
  const file = new File(['audio'], 'sample.wav', { type: 'audio/wav' });

  return {
    sourceId: SOURCE_ID,
    objectUrl: OBJECT_URL,
    audioFile: {
      file,
      name: file.name,
      size: file.size,
      formattedSize: '5 Bytes',
      type: file.type,
      duration: 12.5,
      formattedDuration: '0:12',
      url: OBJECT_URL,
      volume: 1,
    },
  };
}

function executeImport(stagedSource = createStagedSource()) {
  return executeAudioFileImport({
    commandExecutor,
    audioSourceStager,
    stagedSource,
    trackId: TRACK_ID,
    regionId: REGION_ID,
  });
}

function createBatchError(failedIndex: number, cause: unknown): CommandBatchExecutionError {
  const commands = createAudioImportCommands({
    trackId: TRACK_ID,
    regionId: REGION_ID,
    stagedSource: createStagedSource(),
  });

  return new CommandBatchExecutionError({
    failedIndex,
    failedCommand: commands[failedIndex],
    completedResults: commands.slice(0, failedIndex).map(() => undefined),
    cause,
  });
}

async function captureCompensationError(execution: Promise<unknown>): Promise<AudioImportCompensationError> {
  try {
    await execution;
  } catch (error) {
    if (error instanceof AudioImportCompensationError) {
      return error;
    }
    throw error;
  }

  throw new Error('AudioImportCompensationError가 발생하지 않았습니다.');
}

describe('새 Track 오디오 파일 가져오기', () => {
  beforeEach(() => {
    execute.mockReset();
    executeMany.mockReset();
    discardPending.mockReset();
  });

  it('명령 묶음이 성공하면 staged AudioFile을 반환한다', async () => {
    const stagedSource = createStagedSource();
    let resolveBatch!: (result: CommandBatchExecutionResult) => void;
    executeMany.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveBatch = resolve;
        })
    );

    const execution = executeImport(stagedSource);

    resolveBatch([undefined, undefined]);

    await expect(execution).resolves.toBe(stagedSource.audioFile);

    expect(executeMany).toHaveBeenCalledWith(
      createAudioImportCommands({ trackId: TRACK_ID, regionId: REGION_ID, stagedSource })
    );
    expect(execute).not.toHaveBeenCalled();
    expect(discardPending).not.toHaveBeenCalled();
  });

  it('ADD_TRACK이 실패하면 pending Source만 정리하고 원래 배치 오류를 다시 던진다', async () => {
    const batchError = createBatchError(0, new Error('Track 생성 실패'));
    executeMany.mockRejectedValueOnce(batchError);

    await expect(executeImport()).rejects.toBe(batchError);

    expect(execute).not.toHaveBeenCalled();
    expect(discardPending).toHaveBeenCalledWith(SOURCE_ID);
  });

  it('LOAD_REGION이 실패하면 생성한 Track을 제거한 뒤 pending Source를 정리한다', async () => {
    const batchError = createBatchError(1, new Error('Region 생성 실패'));
    executeMany.mockRejectedValueOnce(batchError);
    execute.mockResolvedValueOnce(undefined);

    await expect(executeImport()).rejects.toBe(batchError);

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.REMOVE_TRACK, trackId: TRACK_ID });
    expect(discardPending).toHaveBeenCalledWith(SOURCE_ID);
    expect(execute.mock.invocationCallOrder[0]).toBeLessThan(discardPending.mock.invocationCallOrder[0]);
  });

  it('명령 묶음이 실행 전에 거부돼도 pending Source를 정리한다', async () => {
    const validationError = new Error('명령 검증 실패');
    executeMany.mockRejectedValueOnce(validationError);

    await expect(executeImport()).rejects.toBe(validationError);

    expect(execute).not.toHaveBeenCalled();
    expect(discardPending).toHaveBeenCalledWith(SOURCE_ID);
  });

  it('Track 제거가 실패해도 pending Source 정리를 계속 시도한다', async () => {
    const batchError = createBatchError(1, new Error('Region 생성 실패'));
    const removeTrackError = new Error('Track 제거 실패');
    executeMany.mockRejectedValueOnce(batchError);
    execute.mockRejectedValueOnce(removeTrackError);

    const error = await captureCompensationError(executeImport());

    expect(discardPending).toHaveBeenCalledWith(SOURCE_ID);
    expect(error.cause).toBe(batchError);
    expect(error.compensationFailures).toEqual([{ step: `Track 제거: ${TRACK_ID}`, cause: removeTrackError }]);
  });

  it('Track 제거와 pending Source 정리가 모두 실패하면 두 보상 오류를 보존한다', async () => {
    const batchError = createBatchError(1, new Error('Region 생성 실패'));
    const removeTrackError = new Error('Track 제거 실패');
    const discardError = new Error('Source 정리 실패');
    executeMany.mockRejectedValueOnce(batchError);
    execute.mockRejectedValueOnce(removeTrackError);
    discardPending.mockImplementationOnce(() => {
      throw discardError;
    });

    const error = await captureCompensationError(executeImport());

    expect(error.operation).toBe('audio-file-import');
    expect(error.failedPhase).toBe('LOAD_REGION 실행');
    expect(error.cause).toBe(batchError);
    expect(error.compensationFailures).toEqual([
      { step: `Track 제거: ${TRACK_ID}`, cause: removeTrackError },
      { step: `pending Source 정리: ${SOURCE_ID}`, cause: discardError },
    ]);
  });

  it('ADD_TRACK 실패 후 Source 정리도 실패하면 원래 오류와 정리 오류를 보존한다', async () => {
    const batchError = createBatchError(0, new Error('Track 생성 실패'));
    const discardError = new Error('Source 정리 실패');
    executeMany.mockRejectedValueOnce(batchError);
    discardPending.mockImplementationOnce(() => {
      throw discardError;
    });

    const error = await captureCompensationError(executeImport());

    expect(error.failedPhase).toBe('ADD_TRACK 실행');
    expect(error.cause).toBe(batchError);
    expect(error.compensationFailures).toEqual([{ step: `pending Source 정리: ${SOURCE_ID}`, cause: discardError }]);
  });
});
