// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MidiTrackState } from '@/layers/shared/types/midi-state';
import { MidiRecordingControls } from './MidiRecordingControls';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';
const NOTE_ID = '33333333-3333-4333-8333-333333333333';
const mocks = vi.hoisted(() => ({
  connect: vi
    .fn()
    .mockResolvedValue([
      { id: 'keyboard-1', manufacturer: 'Test', name: 'Fake Keyboard', state: 'connected' as const },
    ]),
  execute: vi.fn().mockResolvedValue(undefined),
  recordingState: {
    capturedEventCount: 0,
    inputChannel: null,
    inputId: null,
    isRecording: false,
    trackId: null,
  },
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: mocks.execute }),
  useMidiInput: () => ({ connect: mocks.connect, disconnect: vi.fn(), subscribe: vi.fn() }),
  useMidiRecordingRuntimeState: () => mocks.recordingState,
}));

vi.mock('./MidiRecordingControls.css.ts', () => ({
  button: 'button',
  buttonActive: 'buttonActive',
  controls: 'controls',
  error: 'error',
  field: 'field',
  select: 'select',
  status: 'status',
}));

const midi: MidiTrackState = {
  instrumentId: 'builtin.poly-synth',
  recordMode: 'replace',
  regions: [
    {
      controlLanes: [],
      durationSeconds: 4,
      id: REGION_ID,
      name: 'Verse',
      notes: [
        {
          channel: 1,
          durationSeconds: 0.5,
          id: NOTE_ID,
          pitch: 60,
          startOffsetSeconds: 0.37,
          velocity: 100,
        },
      ],
      startTimeSeconds: 0,
    },
  ],
};

const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderControls() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => {
    root.render(
      createElement(MidiRecordingControls, {
        midi,
        regionId: REGION_ID,
        trackId: TRACK_ID,
        trackName: 'Keys',
      })
    );
  });
  return host;
}

function changeSelect(select: HTMLSelectElement | null, value: string): void {
  const setSelectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!select || !setSelectValue) {
    throw new Error('변경할 MIDI select를 찾지 못했습니다.');
  }
  setSelectValue.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  mocks.connect.mockClear();
  mocks.execute.mockClear();
});

describe('MidiRecordingControls', () => {
  it('입력 장치와 채널을 선택해 MIDI 녹음을 시작한다', async () => {
    const host = renderControls();
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Keys MIDI 입력 연결"]')?.click());
    await act(async () =>
      changeSelect(host.querySelector<HTMLSelectElement>('select[aria-label="Keys MIDI 입력 채널"]'), '2')
    );

    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Keys MIDI 녹음 시작"]')?.click());

    expect(mocks.execute).toHaveBeenCalledWith({
      inputChannel: 2,
      inputId: 'keyboard-1',
      trackId: TRACK_ID,
      type: 'START_MIDI_RECORDING',
    });
  });

  it('Region의 모든 Note를 Quantize하고 transpose한다', async () => {
    const host = renderControls();

    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Keys MIDI Quantize"]')?.click());
    await act(async () =>
      host.querySelector<HTMLButtonElement>('button[aria-label="Keys MIDI +12 transpose"]')?.click()
    );

    expect(mocks.execute).toHaveBeenNthCalledWith(1, {
      noteIds: [NOTE_ID],
      regionId: REGION_ID,
      stepSeconds: 0.25,
      trackId: TRACK_ID,
      type: 'QUANTIZE_MIDI_NOTES',
    });
    expect(mocks.execute).toHaveBeenNthCalledWith(2, {
      noteIds: [NOTE_ID],
      regionId: REGION_ID,
      semitones: 12,
      trackId: TRACK_ID,
      type: 'TRANSPOSE_MIDI_NOTES',
    });
  });
});
