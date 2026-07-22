// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AudioFile } from '@/types/audioFile';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { MAX_FILE_SIZE } from '@/layers/apps/web/components/common/FileDrop/constants/audioConstants';
import { TrackRegionImportControl } from './TrackRegionImportControl';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const AUDIO_URL = 'blob:https://example.com/33333333-3333-4333-8333-333333333333';

const layerMocks = vi.hoisted(() => ({
  currentTime: 8.25,
  addAudioFile: vi.fn(),
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
}));

const conversionMocks = vi.hoisted(() => ({
  convertFileToAudioFile: vi.fn(),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useSession: (selector: (state: { currentTime: number; addAudioFile: typeof layerMocks.addAudioFile }) => unknown) =>
    selector({ currentTime: layerMocks.currentTime, addAudioFile: layerMocks.addAudioFile }),
}));

vi.mock('@/utils/audio/convert-file-to-audio-file', () => ({
  convertFileToAudioFile: conversionMocks.convertFileToAudioFile,
}));

vi.mock('./TrackRegionImportControl.css.ts', () => ({
  button: 'button',
  input: 'input',
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createAudioFile(file: File): AudioFile {
  return {
    file,
    name: file.name,
    size: file.size,
    formattedSize: `${file.size} B`,
    type: file.type,
    duration: 4.5,
    formattedDuration: '0:05',
    url: AUDIO_URL,
  };
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderControl(onPendingChange = vi.fn()) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);

  act(() => root.render(createElement(TrackRegionImportControl, { trackId: TRACK_ID, onPendingChange })));

  const input = host.querySelector<HTMLInputElement>('input[type="file"]');
  const button = host.querySelector<HTMLButtonElement>('button[aria-label="Region 오디오 파일 추가"]');
  if (!input || !button) {
    throw new Error('Region 파일 입력 요소를 찾지 못했습니다.');
  }

  return { button, host, input, onPendingChange };
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
  layerMocks.currentTime = 8.25;
  layerMocks.addAudioFile.mockReset();
  layerMocks.execute.mockReset();
  conversionMocks.convertFileToAudioFile.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TrackRegionImportControl', () => {
  it('선택한 파일을 현재 시각의 LOAD_REGION 명령으로 실행한다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const audioFile = createAudioFile(file);
    conversionMocks.convertFileToAudioFile.mockResolvedValue({ audioFile, url: AUDIO_URL });
    layerMocks.execute.mockResolvedValue(undefined);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(REGION_ID);
    const { input, onPendingChange } = renderControl();

    selectFile(input, file);
    await flushAsyncWork();

    expect(layerMocks.execute).toHaveBeenCalledTimes(1);
    expect(layerMocks.execute).toHaveBeenCalledWith({
      type: AudioCommandType.LOAD_REGION,
      trackId: TRACK_ID,
      regionId: REGION_ID,
      url: AUDIO_URL,
      startTime: 8.25,
      startOffset: 0,
      duration: 4.5,
    });
    expect(layerMocks.addAudioFile).toHaveBeenCalledWith(AUDIO_URL, audioFile);
    expect(onPendingChange).toHaveBeenNthCalledWith(1, true);
    expect(onPendingChange).toHaveBeenLastCalledWith(false);
  });

  it('숨겨진 파일 입력은 키보드 탭 순서에서 제외한다', () => {
    const { button, input } = renderControl();

    expect(input.tabIndex).toBe(-1);
    expect(button.tabIndex).toBe(0);
  });

  it('처리 중에는 중복 파일 선택을 막는다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    const execution = createDeferred<unknown>();
    conversionMocks.convertFileToAudioFile.mockResolvedValue({ audioFile: createAudioFile(file), url: AUDIO_URL });
    layerMocks.execute.mockReturnValue(execution.promise);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(REGION_ID);
    const { button, input } = renderControl();

    selectFile(input, file);
    await flushAsyncWork();

    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    selectFile(input, file);
    expect(layerMocks.execute).toHaveBeenCalledTimes(1);

    await act(async () => execution.resolve(undefined));

    expect(input.disabled).toBe(false);
  });

  it('명령 실패 시 원인을 알리고 Session에 파일을 보관하지 않는다', async () => {
    const file = new File(['audio'], 'voice.wav', { type: 'audio/wav' });
    conversionMocks.convertFileToAudioFile.mockResolvedValue({ audioFile: createAudioFile(file), url: AUDIO_URL });
    layerMocks.execute.mockRejectedValue(new Error('디코딩 오류'));
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(REGION_ID);
    const alert = vi.fn();
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(vi.fn());
    vi.stubGlobal('alert', alert);
    const { input } = renderControl();

    selectFile(input, file);
    await flushAsyncWork();

    expect(layerMocks.addAudioFile).not.toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith(AUDIO_URL);
    expect(alert).toHaveBeenCalledWith('Region을 추가하지 못했습니다: 디코딩 오류');
  });

  it('지원하지 않는 파일 형식은 변환하지 않는다', () => {
    const alert = vi.fn();
    vi.stubGlobal('alert', alert);
    const { input } = renderControl();

    selectFile(input, new File(['text'], 'notes.txt', { type: 'text/plain' }));

    expect(conversionMocks.convertFileToAudioFile).not.toHaveBeenCalled();
    expect(layerMocks.execute).not.toHaveBeenCalled();
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
    expect(layerMocks.execute).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('파일 크기는 500MB 이하여야 합니다.');
  });
});
