// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { MixerView } from './MixerView';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const BUS_ID = '22222222-2222-4222-8222-222222222222';
const FOLDER_ID = '33333333-3333-4333-8333-333333333333';
const VCA_ID = '44444444-4444-4444-8444-444444444444';
const SEND_ID = '55555555-5555-4555-8555-555555555555';
const NEW_TRACK_ID = '66666666-6666-4666-8666-666666666666';

const commandExecutor = { execute: vi.fn(async () => undefined) };
const layerState = {
  tracks: new Map([
    [
      TRACK_ID,
      {
        id: TRACK_ID,
        name: 'Audio 1',
        volume: 0.8,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      },
    ],
    [
      BUS_ID,
      {
        id: BUS_ID,
        name: 'Drum Bus',
        volume: 1,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      },
    ],
    [
      FOLDER_ID,
      {
        id: FOLDER_ID,
        name: 'Drums',
        volume: 1,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      },
    ],
    [
      VCA_ID,
      {
        id: VCA_ID,
        name: 'Drum VCA',
        volume: 1,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        status: [],
        pluginInstances: [],
        regions: [],
      },
    ],
  ]),
  routingGraph: {
    routes: [
      {
        channelCount: 2 as const,
        folderId: FOLDER_ID,
        kind: 'audio' as const,
        output: { kind: 'master' as const },
        trackId: TRACK_ID,
        vcaIds: [VCA_ID],
      },
      {
        channelCount: 2 as const,
        folderId: null,
        kind: 'bus' as const,
        output: { kind: 'master' as const },
        trackId: BUS_ID,
        vcaIds: [],
      },
      {
        channelCount: 2 as const,
        folderId: null,
        kind: 'folder' as const,
        output: { kind: 'none' as const },
        trackId: FOLDER_ID,
        vcaIds: [],
      },
      {
        channelCount: 2 as const,
        folderId: null,
        kind: 'vca' as const,
        output: { kind: 'none' as const },
        trackId: VCA_ID,
        vcaIds: [],
      },
    ],
    sends: [
      {
        destinationTrackId: BUS_ID,
        gain: 0.5,
        id: SEND_ID,
        isEnabled: true,
        sourceTrackId: TRACK_ID,
        tapPoint: 'postFader' as const,
      },
    ],
  },
};

const monitorState = { isCut: false, isDimmed: false, isMono: false };

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAudioMonitorState: () => monitorState,
  useCommandExecutor: () => commandExecutor,
  useSession: (selector: (state: typeof layerState) => unknown) => selector(layerState),
}));

vi.mock('../AudioLevelMeter/AudioLevelMeter', () => ({
  AudioLevelMeter: ({ label }: { label: string }) => createElement('div', { 'data-meter': label }),
}));

vi.mock('../DawHeader/MasterVolumeControl', () => ({
  MasterVolumeControl: () => createElement('div', { 'data-testid': 'master-volume' }),
}));

vi.mock('./MixerView.css.ts', () => ({
  addSendButton: 'addSendButton',
  addSendRow: 'addSendRow',
  addTrackButton: 'addTrackButton',
  channelCount: 'channelCount',
  checkboxLabel: 'checkboxLabel',
  compactSelect: 'compactSelect',
  container: 'container',
  error: 'error',
  faderControls: 'faderControls',
  fieldLabel: 'fieldLabel',
  groupControls: 'groupControls',
  masterStrip: 'masterStrip',
  monitorLabel: 'monitorLabel',
  monitorSection: 'monitorSection',
  noSignalPath: 'noSignalPath',
  pan: 'pan',
  removeSendButton: 'removeSendButton',
  routeKind: 'routeKind',
  sectionLabel: 'sectionLabel',
  select: 'select',
  sendDestination: 'sendDestination',
  sendGain: 'sendGain',
  sendRow: 'sendRow',
  sendSection: 'sendSection',
  strip: 'strip',
  stripHeader: 'stripHeader',
  strips: 'strips',
  subtitle: 'subtitle',
  title: 'title',
  toggleButton: 'toggleButton',
  toggleButtonActive: 'toggleButtonActive',
  toolbar: 'toolbar',
  trackCreator: 'trackCreator',
  trackId: 'trackId',
  trackName: 'trackName',
  trackToggleRow: 'trackToggleRow',
  vcaFieldset: 'vcaFieldset',
  verticalFader: 'verticalFader',
  verticalFaderLabel: 'verticalFaderLabel',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mountMixer(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(MixerView)));
  return host;
}

async function changeSelect(select: HTMLSelectElement | null, value: string): Promise<void> {
  if (!select) {
    throw new Error('대상 select를 찾지 못했습니다.');
  }
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  commandExecutor.execute.mockClear();
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(NEW_TRACK_ID);
});

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('MixerView', () => {
  it('Track 종류, I/O, Send와 Master Monitor를 한 화면에 표시한다', () => {
    const host = mountMixer();

    expect(host.querySelector('[aria-label="Mixer Track Audio 1"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Mixer Track Drum Bus"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Mixer Track Drums"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Mixer Track Drum VCA"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Audio 1 output"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Audio 1 Send Drum Bus"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Master strip"]')).not.toBeNull();
  });

  it('Track 출력 변경을 기존 Route 속성과 함께 명령으로 보낸다', async () => {
    const host = mountMixer();

    await changeSelect(host.querySelector<HTMLSelectElement>('[aria-label="Audio 1 output"]'), `track:${BUS_ID}`);

    expect(commandExecutor.execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_TRACK_ROUTING,
      channelCount: 2,
      kind: 'audio',
      output: { kind: 'track', trackId: BUS_ID },
      trackId: TRACK_ID,
    });
  });

  it('Send를 추가하고 Monitor dim을 runtime 명령으로 변경한다', async () => {
    const host = mountMixer();

    await changeSelect(host.querySelector<HTMLSelectElement>('[aria-label="Audio 1 new Send destination"]'), BUS_ID);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Add Send to Audio 1"]')?.click());
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Monitor Dim"]')?.click());

    expect(commandExecutor.execute).toHaveBeenNthCalledWith(1, {
      type: AudioCommandType.ADD_SEND,
      destinationTrackId: BUS_ID,
      gain: 1,
      id: NEW_TRACK_ID,
      isEnabled: true,
      sourceTrackId: TRACK_ID,
      tapPoint: 'postFader',
    });
    expect(commandExecutor.execute).toHaveBeenNthCalledWith(2, {
      type: AudioCommandType.SET_MONITOR_STATE,
      isCut: false,
      isDimmed: true,
      isMono: false,
    });
  });

  it('Bus 추가 버튼으로 stereo Bus Track 명령을 보낸다', async () => {
    const host = mountMixer();

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Add Bus Track"]')?.click());

    expect(commandExecutor.execute).toHaveBeenCalledWith({
      type: AudioCommandType.ADD_TRACK,
      channelCount: 2,
      kind: 'bus',
      trackId: NEW_TRACK_ID,
    });
  });
});
