// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import type { RenderJobState } from '@/layers/shared/types/render-job';
import { ExportButton } from './ExportButton';

const testState = vi.hoisted(() => ({
  downloadRenderJobFiles: vi.fn(),
  execute: vi.fn(),
  layerState: {
    exportSettings: {
      activePresetId: 'default-wav',
      presets: [
        {
          channelMode: 'stereo' as const,
          dither: 'tpdf' as const,
          exportMode: 'mix' as const,
          format: 'wav' as const,
          id: 'default-wav',
          name: 'WAV 16-bit / 44.1 kHz',
          normalization: { mode: 'none' as const },
          sampleFormat: 'pcm16' as const,
          sampleRate: 44_100,
        },
      ],
      ranges: [],
    },
    tracks: new Map([['track-1', { regions: [{ endTime: 8 }] }]]),
  },
  renderJobState: {
    completedFileCount: 0,
    errorMessage: null,
    jobId: null,
    outputFileCount: 0,
    progress: 0,
    stage: 'idle',
    status: 'idle',
  } as RenderJobState,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: testState.execute }),
  useRenderJobState: () => testState.renderJobState,
  useSession: (selector: (state: typeof testState.layerState) => unknown) => selector(testState.layerState),
}));

vi.mock('@/layers/apps/web/keyboard-shortcuts/keyboard-shortcuts', () => ({
  KeyboardShortcutAction: { EXPORT_AUDIO: 'EXPORT_AUDIO' },
  KEYBOARD_SHORTCUT_LABELS: { EXPORT_AUDIO: 'Ctrl/⌘+Shift+E' },
  useKeyboardShortcutAction: vi.fn(),
}));

vi.mock('./download-render-job-files', () => ({ downloadRenderJobFiles: testState.downloadRenderJobFiles }));

vi.mock('./ExportButton.css.ts', () => ({
  backdrop: 'backdrop',
  cancelButton: 'cancelButton',
  capabilityNotice: 'capabilityNotice',
  closeButton: 'closeButton',
  container: 'container',
  dialog: 'dialog',
  dialogBody: 'dialogBody',
  dialogFooter: 'dialogFooter',
  dialogHeader: 'dialogHeader',
  errorMessage: 'errorMessage',
  exportButton: 'exportButton',
  field: 'field',
  fieldGrid: 'fieldGrid',
  inlineActions: 'inlineActions',
  primaryButton: 'primaryButton',
  progressBar: 'progressBar',
  progressFill: 'progressFill',
  rangeList: 'rangeList',
  rangeRow: 'rangeRow',
  removeButton: 'removeButton',
  resultCard: 'resultCard',
  resultList: 'resultList',
  secondaryButton: 'secondaryButton',
  section: 'section',
  sectionHeader: 'sectionHeader',
  statusPanel: 'statusPanel',
  statusSummary: 'statusSummary',
  subtitle: 'subtitle',
  title: 'title',
}));

describe('ExportButton', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    testState.execute.mockReset();
    testState.downloadRenderJobFiles.mockReset();
    testState.renderJobState = {
      completedFileCount: 0,
      errorMessage: null,
      jobId: null,
      outputFileCount: 0,
      progress: 0,
      stage: 'idle',
      status: 'idle',
    };
    act(() => root.render(createElement(ExportButton)));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('Export 설정 창에서 지원 형식과 encoder 제한을 표시한다', () => {
    clickButton('Export');

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Export & Analysis');
    expect(findSelect('Format').options[0]?.text).toContain('WAV');
    expect(findSelect('Format').options[1]?.disabled).toBe(true);
    expect(document.body.textContent).toContain('FLAC·MP3 encoder가 설치되지 않아 WAV만 사용할 수 있습니다.');
    expect(findSelect('Sample format').value).toBe('pcm16');
    expect(findSelect('Sample rate').value).toBe('44100');
    expect(findSelect('Channels').value).toBe('stereo');
  });

  it('preset과 다중 range 변경을 SET_EXPORT_SETTINGS 명령으로 저장한다', async () => {
    clickButton('Export');
    changeSelect('Sample format', 'pcm24');
    changeSelect('Sample rate', '48000');
    clickButton('Add range');
    const rangeNames = document.querySelectorAll<HTMLInputElement>('input[aria-label^="Range name"]');
    changeInput(rangeNames[1], 'Outro');

    await clickButtonAsync('Save settings');

    expect(testState.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          presets: [expect.objectContaining({ sampleFormat: 'pcm24', sampleRate: 48_000 })],
          ranges: [expect.objectContaining({ name: 'Mix' }), expect.objectContaining({ name: 'Outro' })],
        }),
        type: AudioCommandType.SET_EXPORT_SETTINGS,
      })
    );
  });

  it('설정을 저장한 뒤 RenderJob을 시작하고 완성된 파일을 내려받는다', async () => {
    const result = {
      files: [
        {
          analysis: {
            integratedLufs: -14,
            loudnessRangeLu: 3,
            normalizationGainDb: 2,
            samplePeakDbfs: -2,
            truePeakDbtp: -1,
          },
          blob: new Blob(['wav'], { type: 'audio/wav' }),
          fileName: 'Mix.wav',
          rangeId: 'range-1',
          trackId: null,
        },
      ],
      jobId: 'job-1',
    };
    testState.execute.mockResolvedValueOnce(undefined).mockResolvedValueOnce(result);
    clickButton('Export');

    await clickButtonAsync('Start export');

    expect(testState.execute.mock.calls.map(call => call[0].type)).toEqual([
      AudioCommandType.SET_EXPORT_SETTINGS,
      AudioCommandType.START_RENDER_JOB,
    ]);
    expect(testState.downloadRenderJobFiles).toHaveBeenCalledWith(result);
    expect(document.body.textContent).toContain('Mix.wav');
    expect(document.body.textContent).toContain('-14.0 LUFS');
    expect(document.body.textContent).toContain('-1.0 dBTP');
    expect(document.body.textContent).toContain('+2.0 dB');
  });

  it('실행 중에는 진행률을 표시하고 대기열을 거치지 않는 취소 명령을 보낸다', async () => {
    testState.renderJobState = {
      completedFileCount: 1,
      errorMessage: null,
      jobId: '11111111-1111-4111-8111-111111111111',
      outputFileCount: 4,
      progress: 0.25,
      stage: 'rendering',
      status: 'running',
    };
    act(() => root.render(createElement(ExportButton)));
    clickButton('Export');

    expect(document.body.textContent).toContain('25%');
    expect(document.body.textContent).toContain('1 / 4 files');
    await clickButtonAsync('Cancel export');

    expect(testState.execute).toHaveBeenCalledWith({
      jobId: '11111111-1111-4111-8111-111111111111',
      type: AudioCommandType.CANCEL_RENDER_JOB,
    });
  });

  function clickButton(name: string): void {
    const button = [...document.querySelectorAll('button')].find(candidate => candidate.textContent?.trim() === name);
    if (!button) {
      throw new Error(`Button not found: ${name}`);
    }
    act(() => button.click());
  }

  async function clickButtonAsync(name: string): Promise<void> {
    await act(async () => clickButton(name));
  }

  function findSelect(label: string): HTMLSelectElement {
    const select = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
    if (!select) {
      throw new Error(`Select not found: ${label}`);
    }
    return select;
  }

  function changeSelect(label: string, value: string): void {
    const select = findSelect(label);
    act(() => {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function changeInput(input: HTMLInputElement | undefined, value: string): void {
    if (!input) {
      throw new Error('Input not found');
    }
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
});
