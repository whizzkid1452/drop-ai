// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCliTestApp } from '@/layers/apps/create-app';
import { LayerProvider } from '@/layers/apps/web/context/layer-provider';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { MixerView } from './MixerView';

const AUDIO_TRACK_ID = '11111111-1111-4111-8111-111111111111';
const BUS_TRACK_ID = '22222222-2222-4222-8222-222222222222';

vi.mock('../AudioLevelMeter/AudioLevelMeter', () => ({
  AudioLevelMeter: () => null,
}));

vi.mock('../DawHeader/MasterVolumeControl', () => ({
  MasterVolumeControl: () => null,
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

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('MixerView 통합', () => {
  it('출력 select 변경 뒤 AudioCommand가 runtime과 Session Route를 함께 변경한다', async () => {
    const app = createCliTestApp();
    await app.commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: AUDIO_TRACK_ID });
    await app.commandExecutor.execute({
      type: AudioCommandType.ADD_TRACK,
      channelCount: 2,
      kind: 'bus',
      trackId: BUS_TRACK_ID,
    });
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    act(() => root.render(createElement(LayerProvider, { app }, createElement(MixerView))));
    const output = host.querySelector<HTMLSelectElement>(
      `article[data-route-kind="audio"] select[aria-label$=" output"]`
    );
    if (!output) {
      throw new Error('Audio Track 출력 select를 찾지 못했습니다.');
    }

    await act(async () => {
      output.value = `track:${BUS_TRACK_ID}`;
      output.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(app.session.getState().routingGraph.routes[0]?.output).toEqual({
      kind: 'track',
      trackId: BUS_TRACK_ID,
    });
  });

  it('화면을 연 뒤 Bus를 추가하면 기존 Audio Track의 Send 대상을 즉시 갱신한다', async () => {
    const app = createCliTestApp();
    await app.commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: AUDIO_TRACK_ID });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(BUS_TRACK_ID);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    act(() => root.render(createElement(LayerProvider, { app }, createElement(MixerView))));

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Add Bus Track"]')?.click());

    const addSend = host.querySelector<HTMLButtonElement>(`[aria-label^="Add Send to "]`);
    expect(addSend?.disabled).toBe(false);
    expect(host.querySelector<HTMLSelectElement>('[aria-label$=" new Send destination"]')?.value).toBe(BUS_TRACK_ID);
  });
});
