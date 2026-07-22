// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IAudioSourceStager } from '@/layers/audio-source-registry/i-audio-source-registry';
import type { CommandExecutor } from '@/layers/commands/command-executor';
import type { StagedWebAudioSource } from '@/layers/apps/web/hooks/stage-web-audio-source';
import type { AudioFileMetadata } from '@/utils/audio/convert-file-to-audio-file';
import { AudioFileDrop } from './AudioFileDrop';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_ID = '33333333-3333-4333-8333-333333333333';
const OBJECT_URL = 'blob:https://example.com/audio';

const basicFileDropMocks = vi.hoisted(() => ({
  onFileDrop: null as ((file: File) => Promise<void>) | null,
}));

const layerMocks = vi.hoisted(() => ({
  stage: vi.fn<IAudioSourceStager['stage']>(),
  discardPending: vi.fn<IAudioSourceStager['discardPending']>(),
  execute: vi.fn<CommandExecutor['execute']>(),
  executeMany: vi.fn<CommandExecutor['executeMany']>(),
}));

const conversionMocks = vi.hoisted(() => ({
  convertFileToAudioFile: vi.fn(),
}));

const stagingMocks = vi.hoisted(() => ({
  stageWebAudioSource: vi.fn(),
}));

const executionMocks = vi.hoisted(() => ({
  executeAudioFileImport: vi.fn(),
}));

vi.mock('./BasicFileDrop', () => ({
  BasicFileDrop: ({ onFileDrop }: { onFileDrop: (file: File) => Promise<void> }) => {
    basicFileDropMocks.onFileDrop = onFileDrop;
    return null;
  },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioSourceStager: () => ({
    stage: layerMocks.stage,
    discardPending: layerMocks.discardPending,
  }),
  useCommandExecutor: () => ({
    execute: layerMocks.execute,
    executeMany: layerMocks.executeMany,
  }),
  useSession: () => undefined,
}));

vi.mock('@/utils/audio/convert-file-to-audio-file', () => ({
  convertFileToAudioFile: conversionMocks.convertFileToAudioFile,
}));

vi.mock('@/layers/apps/web/hooks/stage-web-audio-source', () => ({
  stageWebAudioSource: stagingMocks.stageWebAudioSource,
}));

vi.mock('./execute-audio-file-import', () => ({
  executeAudioFileImport: executionMocks.executeAudioFileImport,
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createAudioFileMetadata(file: File): AudioFileMetadata {
  return {
    file,
    name: file.name,
    size: file.size,
    formattedSize: `${file.size} B`,
    type: file.type,
    duration: 4.5,
    formattedDuration: '0:05',
    volume: 1,
  };
}

function createStagedSource(audioFileMetadata: AudioFileMetadata): StagedWebAudioSource {
  return {
    sourceId: SOURCE_ID,
    objectUrl: OBJECT_URL,
    audioFile: { ...audioFileMetadata, url: OBJECT_URL },
  };
}

function renderAudioFileDrop(onAudioFileDrop = vi.fn()) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => root.render(createElement(AudioFileDrop, { onAudioFileDrop })));

  if (basicFileDropMocks.onFileDrop === null) {
    throw new Error('파일 가져오기 callback을 찾지 못했습니다.');
  }

  return { onAudioFileDrop, onFileDrop: basicFileDropMocks.onFileDrop };
}

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  basicFileDropMocks.onFileDrop = null;
  layerMocks.stage.mockReset();
  layerMocks.discardPending.mockReset();
  layerMocks.execute.mockReset();
  layerMocks.executeMany.mockReset();
  conversionMocks.convertFileToAudioFile.mockReset();
  stagingMocks.stageWebAudioSource.mockReset();
  executionMocks.executeAudioFileImport.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AudioFileDrop', () => {
  it('파일을 stage한 뒤 공통 가져오기 workflow에 전달한다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const audioFileMetadata = createAudioFileMetadata(file);
    const stagedSource = createStagedSource(audioFileMetadata);
    conversionMocks.convertFileToAudioFile.mockResolvedValue(audioFileMetadata);
    stagingMocks.stageWebAudioSource.mockReturnValue(stagedSource);
    executionMocks.executeAudioFileImport.mockResolvedValue(stagedSource.audioFile);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(TRACK_ID).mockReturnValueOnce(REGION_ID);
    const { onAudioFileDrop, onFileDrop } = renderAudioFileDrop();

    await act(async () => onFileDrop(file));

    expect(stagingMocks.stageWebAudioSource).toHaveBeenCalledWith({
      audioSourceStager: {
        stage: layerMocks.stage,
        discardPending: layerMocks.discardPending,
      },
      audioFileMetadata,
    });
    expect(executionMocks.executeAudioFileImport).toHaveBeenCalledWith({
      commandExecutor: {
        execute: layerMocks.execute,
        executeMany: layerMocks.executeMany,
      },
      audioSourceStager: {
        stage: layerMocks.stage,
        discardPending: layerMocks.discardPending,
      },
      stagedSource,
      trackId: TRACK_ID,
      regionId: REGION_ID,
    });
    expect(onAudioFileDrop).toHaveBeenCalledWith(stagedSource.audioFile);
  });

  it('파일 metadata 변환에 실패하면 stage하지 않고 null을 알린다', async () => {
    const file = new File(['audio'], 'broken.wav', { type: 'audio/wav' });
    conversionMocks.convertFileToAudioFile.mockResolvedValue(null);
    const { onAudioFileDrop, onFileDrop } = renderAudioFileDrop();

    await act(async () => onFileDrop(file));

    expect(stagingMocks.stageWebAudioSource).not.toHaveBeenCalled();
    expect(executionMocks.executeAudioFileImport).not.toHaveBeenCalled();
    expect(onAudioFileDrop).toHaveBeenCalledWith(null);
  });

  it('stage 실패 시 기존 Source를 추측해 정리하지 않는다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const stageFailure = new Error('Source ID 충돌');
    conversionMocks.convertFileToAudioFile.mockResolvedValue(createAudioFileMetadata(file));
    stagingMocks.stageWebAudioSource.mockImplementation(() => {
      throw stageFailure;
    });
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(TRACK_ID).mockReturnValueOnce(REGION_ID);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { onAudioFileDrop, onFileDrop } = renderAudioFileDrop();

    await act(async () => onFileDrop(file));

    expect(layerMocks.discardPending).not.toHaveBeenCalled();
    expect(executionMocks.executeAudioFileImport).not.toHaveBeenCalled();
    expect(onAudioFileDrop).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('오디오 파일을 가져오지 못했습니다: Source ID 충돌');
  });

  it('가져오기 workflow 실패를 사용자에게 알리고 Promise 오류를 남기지 않는다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const audioFileMetadata = createAudioFileMetadata(file);
    const stagedSource = createStagedSource(audioFileMetadata);
    const importFailure = new Error('Region 보상 실패');
    conversionMocks.convertFileToAudioFile.mockResolvedValue(audioFileMetadata);
    stagingMocks.stageWebAudioSource.mockReturnValue(stagedSource);
    executionMocks.executeAudioFileImport.mockRejectedValue(importFailure);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(TRACK_ID).mockReturnValueOnce(REGION_ID);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { onAudioFileDrop, onFileDrop } = renderAudioFileDrop();

    await act(async () => onFileDrop(file));

    expect(onAudioFileDrop).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('오디오 파일을 가져오지 못했습니다: Region 보상 실패');
  });

  it('가져오기 성공 후 화면 callback 실패는 committed Source를 정리하지 않고 알린다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const audioFileMetadata = createAudioFileMetadata(file);
    const stagedSource = createStagedSource(audioFileMetadata);
    const callbackFailure = new Error('화면 전환 실패');
    conversionMocks.convertFileToAudioFile.mockResolvedValue(audioFileMetadata);
    stagingMocks.stageWebAudioSource.mockReturnValue(stagedSource);
    executionMocks.executeAudioFileImport.mockResolvedValue(stagedSource.audioFile);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(TRACK_ID).mockReturnValueOnce(REGION_ID);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const onAudioFileDrop = vi.fn().mockRejectedValue(callbackFailure);
    const { onFileDrop } = renderAudioFileDrop(onAudioFileDrop);

    await act(async () => onFileDrop(file));

    expect(layerMocks.discardPending).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('오디오 파일 가져오기는 완료됐지만 화면을 갱신하지 못했습니다: 화면 전환 실패');
  });
});
