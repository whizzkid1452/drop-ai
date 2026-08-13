// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IAudioSourceStager } from '@/layers/audio-source-registry/i-audio-source-registry';
import type { CommandExecutor } from '@/layers/commands/command-executor';
import type { StagedWebAudioSource } from '@/layers/apps/web/hooks/stage-web-audio-source';
import type { AudioFileMetadata } from '@/utils/audio/convert-file-to-audio-file';
import { MAX_FILE_SIZE } from '@/layers/apps/web/components/common/FileDrop/constants/audioConstants';
import { AddTrackControl } from './AddTrackControl';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const SOURCE_ID = '33333333-3333-4333-8333-333333333333';

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
  executeMidiFileImport: vi.fn(),
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
  useAudioRuntimeCapabilities: () => ({
    features: { midi: { blockers: [], status: 'available' } },
  }),
}));

vi.mock('@/utils/audio/convert-file-to-audio-file', () => ({
  convertFileToAudioFile: conversionMocks.convertFileToAudioFile,
}));

vi.mock('@/layers/apps/web/hooks/stage-web-audio-source', () => ({
  stageWebAudioSource: stagingMocks.stageWebAudioSource,
}));

vi.mock('@/layers/apps/web/components/common/FileDrop/execute-audio-file-import', () => ({
  executeAudioFileImport: executionMocks.executeAudioFileImport,
}));

vi.mock('@/layers/apps/web/midi/execute-midi-file-import', () => ({
  executeMidiFileImport: executionMocks.executeMidiFileImport,
}));

vi.mock('./AddTrackControl.css.ts', () => ({
  button: 'button',
  input: 'input',
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

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
  };
}

function createStagedSource(audioFileMetadata: AudioFileMetadata): StagedWebAudioSource {
  return {
    sourceId: SOURCE_ID,
    audioFile: audioFileMetadata,
  };
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderControl() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => root.render(createElement(AddTrackControl)));

  const input = host.querySelector<HTMLInputElement>('input[type="file"]');
  const button = host.querySelector<HTMLButtonElement>('button[aria-label="새 오디오 Track 추가"]');
  if (!input || !button) {
    throw new Error('새 Track 파일 입력 요소를 찾지 못했습니다.');
  }

  return { button, input };
}

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function flushAsyncWork() {
  await act(async () => Promise.resolve());
}

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  layerMocks.stage.mockReset();
  layerMocks.discardPending.mockReset();
  layerMocks.execute.mockReset();
  layerMocks.executeMany.mockReset();
  conversionMocks.convertFileToAudioFile.mockReset();
  stagingMocks.stageWebAudioSource.mockReset();
  executionMocks.executeAudioFileImport.mockReset();
  executionMocks.executeMidiFileImport.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AddTrackControl', () => {
  it('빈 MIDI Track 추가를 명령 경로로 전달한다', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(TRACK_ID);
    layerMocks.execute.mockResolvedValue(undefined);
    renderControl();
    const midiButton = document.querySelector<HTMLButtonElement>('button[aria-label="빈 MIDI Track 추가"]');

    await act(async () => midiButton?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({ trackId: TRACK_ID, type: 'ADD_MIDI_TRACK' });
  });

  it('선택한 MIDI 파일을 명령 기반 가져오기로 전달한다', async () => {
    const file = new File(['midi'], 'keys.mid', { type: 'audio/midi' });
    executionMocks.executeMidiFileImport.mockResolvedValue([TRACK_ID]);
    renderControl();
    const input = document.querySelector<HTMLInputElement>('input[aria-label="MIDI 파일 선택"]');
    if (!input) {
      throw new Error('MIDI 파일 입력을 찾지 못했습니다.');
    }

    selectFile(input, file);
    await flushAsyncWork();

    expect(executionMocks.executeMidiFileImport).toHaveBeenCalledWith({
      commandExecutor: { execute: layerMocks.execute, executeMany: layerMocks.executeMany },
      createId: expect.any(Function),
      file,
    });
  });

  it('선택한 파일로 새 Track과 첫 Region을 가져온다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const audioFileMetadata = createAudioFileMetadata(file);
    const stagedSource = createStagedSource(audioFileMetadata);
    conversionMocks.convertFileToAudioFile.mockResolvedValue(audioFileMetadata);
    stagingMocks.stageWebAudioSource.mockReturnValue(stagedSource);
    executionMocks.executeAudioFileImport.mockResolvedValue(stagedSource.audioFile);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(TRACK_ID).mockReturnValueOnce(REGION_ID);
    const { input } = renderControl();

    selectFile(input, file);
    await flushAsyncWork();

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
  });

  it('가져오는 동안에는 중복 파일 선택을 막는다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const audioFileMetadata = createAudioFileMetadata(file);
    const stagedSource = createStagedSource(audioFileMetadata);
    const execution = createDeferred<typeof stagedSource.audioFile>();
    conversionMocks.convertFileToAudioFile.mockResolvedValue(audioFileMetadata);
    stagingMocks.stageWebAudioSource.mockReturnValue(stagedSource);
    executionMocks.executeAudioFileImport.mockReturnValue(execution.promise);
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(TRACK_ID).mockReturnValueOnce(REGION_ID);
    const { button, input } = renderControl();

    selectFile(input, file);
    await flushAsyncWork();

    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');

    await act(async () => execution.resolve(stagedSource.audioFile));

    expect(input.disabled).toBe(false);
    expect(button.disabled).toBe(false);
  });

  it('지원하지 않는 파일 형식은 변환하지 않는다', () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { input } = renderControl();

    selectFile(input, new File(['text'], 'notes.txt', { type: 'text/plain' }));

    expect(conversionMocks.convertFileToAudioFile).not.toHaveBeenCalled();
    expect(executionMocks.executeAudioFileImport).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('지원하지 않는 오디오 형식입니다.');
  });

  it('500MB를 넘는 파일은 변환하지 않는다', () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const file = new File(['audio'], 'large.wav', { type: 'audio/wav' });
    Object.defineProperty(file, 'size', { configurable: true, value: MAX_FILE_SIZE + 1 });
    const { input } = renderControl();

    selectFile(input, file);

    expect(conversionMocks.convertFileToAudioFile).not.toHaveBeenCalled();
    expect(executionMocks.executeAudioFileImport).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('파일 크기는 500MB 이하여야 합니다.');
  });

  it('가져오기 실패를 알리고 다시 시도할 수 있게 한다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const audioFileMetadata = createAudioFileMetadata(file);
    const stagedSource = createStagedSource(audioFileMetadata);
    conversionMocks.convertFileToAudioFile.mockResolvedValue(audioFileMetadata);
    stagingMocks.stageWebAudioSource.mockReturnValue(stagedSource);
    executionMocks.executeAudioFileImport.mockRejectedValue(new Error('디코딩 오류'));
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(TRACK_ID).mockReturnValueOnce(REGION_ID);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { button, input } = renderControl();

    selectFile(input, file);
    await flushAsyncWork();

    expect(alert).toHaveBeenCalledWith('새 Track을 추가하지 못했습니다: 디코딩 오류');
    expect(input.disabled).toBe(false);
    expect(button.disabled).toBe(false);
  });
});
