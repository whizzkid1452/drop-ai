// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCliTestApp, type AppInstance } from '@/layers/apps/create-app';
import { LayerProvider } from '@/layers/apps/web/context/layer-provider';
import type { IMidiInput, MidiInputListener, MidiNoteOnEvent } from '@/layers/midi-input/i-midi-input';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { AudioRuntimeFeature } from '@/layers/shared/utils/audio-runtime-capabilities';
import { MidiLoopControl } from './MidiLoopControl';

vi.mock('./MidiLoopControl.css', () => ({
  button: 'button',
  channelSelect: 'channelSelect',
  connectedButton: 'connectedButton',
  container: 'container',
  hint: 'hint',
  label: 'label',
  select: 'select',
}));

const TRACK_ID = '11111111-1111-4111-8111-111111111111';

class FakeMidiInput implements IMidiInput {
  readonly connect = vi
    .fn()
    .mockResolvedValue([{ id: 'input-1', manufacturer: '테스트', name: '패드', state: 'connected' as const }]);
  readonly disconnect = vi.fn();
  readonly #listeners = new Set<MidiInputListener>();

  emit(event: MidiNoteOnEvent): void {
    this.#listeners.forEach(listener => listener(event));
  }

  subscribe(listener: MidiInputListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
});

describe('MidiLoopControl', () => {
  it('루프 runtime이 지원되지 않으면 MIDI 연결을 비활성화한다', () => {
    const baseApp = createCliTestApp();
    const app: AppInstance = {
      ...baseApp,
      audioRuntimeCapabilities: {
        ...baseApp.audioRuntimeCapabilities,
        features: {
          ...baseApp.audioRuntimeCapabilities.features,
          [AudioRuntimeFeature.LIVE_LOOP]: { blockers: [], status: 'unsupported' },
        },
      },
    };
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(LayerProvider, { app }, createElement(MidiLoopControl))));

    const connectButton = [...host.querySelectorAll('button')].find(button => button.textContent === 'CONNECT');
    expect(connectButton?.disabled).toBe(true);
    expect(connectButton?.title).toContain('현재 runtime에 구현되지 않음');
  });

  it('연결 후 Note On을 선택 트랙의 루프 명령으로 실행한다', async () => {
    const baseApp = createCliTestApp();
    await baseApp.commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });
    const midiInput = new FakeMidiInput();
    const app: AppInstance = {
      ...baseApp,
      audioRuntimeCapabilities: {
        ...baseApp.audioRuntimeCapabilities,
        features: {
          ...baseApp.audioRuntimeCapabilities.features,
          [AudioRuntimeFeature.LIVE_LOOP]: { blockers: [], status: 'available' },
        },
      },
      midiInput,
    };
    const execute = vi.spyOn(app.commandExecutor, 'execute').mockResolvedValue(undefined);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(LayerProvider, { app }, createElement(MidiLoopControl))));
    const connectButton = [...host.querySelectorAll('button')].find(button => button.textContent === 'CONNECT');
    if (!connectButton) {
      throw new Error('MIDI 연결 버튼이 없습니다.');
    }
    await act(async () => connectButton.click());
    act(() => midiInput.emit({ channel: 1, inputId: 'input-1', note: 36, type: 'noteOn', velocity: 100 }));

    const firstLoopSlot = app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0];
    expect(execute).toHaveBeenCalledWith({
      lengthBars: 1,
      quantizationBars: 1,
      slotId: firstLoopSlot?.id,
      trackId: TRACK_ID,
      type: AudioCommandType.ARM_LOOP_SLOT,
    });
  });
});
