// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MidiTrackState } from '@/layers/shared/types/midi-state';
import { PianoRollEditor } from './PianoRollEditor';

const REGION_ID = '11111111-1111-4111-8111-111111111111';
const NOTE_ID = '22222222-2222-4222-8222-222222222222';
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
          startOffsetSeconds: 1,
          velocity: 96,
        },
      ],
      startTimeSeconds: 0,
    },
  ],
};

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('./PianoRollEditor.css.ts', () => ({
  button: 'button',
  controlLaneActions: 'controlLaneActions',
  controlLaneEditor: 'controlLaneEditor',
  controlPoint: 'controlPoint',
  error: 'error',
  grid: 'grid',
  header: 'header',
  help: 'help',
  inspector: 'inspector',
  inspectorInput: 'inspectorInput',
  inspectorLabel: 'inspectorLabel',
  keyboard: 'keyboard',
  note: 'note',
  noteSelected: 'noteSelected',
  roll: 'roll',
  titleRow: 'titleRow',
}));

function renderEditor(onChange = vi.fn().mockResolvedValue(undefined), midiState: MidiTrackState = midi) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => {
    root.render(
      createElement(PianoRollEditor, {
        editPointSeconds: 1.5,
        midi: midiState,
        onChange,
        regionId: REGION_ID,
        trackName: 'Keys',
      })
    );
  });
  return { host, onChange };
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('PianoRollEditor', () => {
  it('edit point에 기본 note를 추가한다', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('33333333-3333-4333-8333-333333333333');
    const { host, onChange } = renderEditor();

    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Keys MIDI note 추가"]')?.click());

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        regions: [
          expect.objectContaining({
            notes: [
              expect.objectContaining({ id: NOTE_ID }),
              expect.objectContaining({
                durationSeconds: 0.5,
                pitch: 60,
                startOffsetSeconds: 1.5,
                velocity: 100,
              }),
            ],
          }),
        ],
      })
    );
  });

  it('키보드로 note 위치와 길이를 0.25초 단위로 변경한다', async () => {
    const { host, onChange } = renderEditor();
    const note = host.querySelector<HTMLElement>(`[data-note-id="${NOTE_ID}"]`);

    await act(async () => note?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' })));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        regions: [expect.objectContaining({ notes: [expect.objectContaining({ startOffsetSeconds: 1.25 })] })],
      })
    );

    await act(async () =>
      note?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight', shiftKey: true }))
    );
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        regions: [expect.objectContaining({ notes: [expect.objectContaining({ durationSeconds: 0.75 })] })],
      })
    );
  });

  it('선택한 note의 velocity를 변경하고 삭제한다', async () => {
    const { host, onChange } = renderEditor();
    const note = host.querySelector<HTMLElement>(`[data-note-id="${NOTE_ID}"]`);
    act(() => note?.click());
    const velocity = host.querySelector<HTMLInputElement>('input[aria-label="Keys note velocity"]');
    const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

    await act(async () => {
      if (velocity && setInputValue) {
        setInputValue.call(velocity, '64');
        velocity.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        regions: [expect.objectContaining({ notes: [expect.objectContaining({ velocity: 64 })] })],
      })
    );

    await act(async () => note?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Delete' })));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ regions: [expect.objectContaining({ notes: [] })] })
    );
  });

  it('edit point에 CC lane과 첫 제어 point를 추가한다', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('33333333-3333-4333-8333-333333333333')
      .mockReturnValueOnce('44444444-4444-4444-8444-444444444444');
    const { host, onChange } = renderEditor();

    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Keys CC lane 추가"]')?.click());

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        regions: [
          expect.objectContaining({
            controlLanes: [
              expect.objectContaining({
                channel: 1,
                controllerNumber: 1,
                points: [expect.objectContaining({ timeOffsetSeconds: 1.5, value: 64 })],
                type: 'controlChange',
              }),
            ],
          }),
        ],
      })
    );
  });

  it('선택한 pitch bend point 값을 MIDI 범위 안에서 변경한다', async () => {
    const midiWithControlLane: MidiTrackState = {
      ...midi,
      regions: [
        {
          ...midi.regions[0],
          controlLanes: [
            {
              channel: 1,
              id: '33333333-3333-4333-8333-333333333333',
              points: [
                {
                  id: '44444444-4444-4444-8444-444444444444',
                  timeOffsetSeconds: 1,
                  value: 0,
                },
              ],
              type: 'pitchBend',
            },
          ],
        },
      ],
    };
    const { host, onChange } = renderEditor(vi.fn().mockResolvedValue(undefined), midiWithControlLane);
    const valueInput = host.querySelector<HTMLInputElement>('input[aria-label="Keys Pitch Bend point 1 값"]');
    const setInputValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;

    await act(async () => {
      if (valueInput && setInputValue) {
        setInputValue.call(valueInput, '9000');
        valueInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        regions: [
          expect.objectContaining({
            controlLanes: [expect.objectContaining({ points: [expect.objectContaining({ value: 8191 })] })],
          }),
        ],
      })
    );
  });
});
