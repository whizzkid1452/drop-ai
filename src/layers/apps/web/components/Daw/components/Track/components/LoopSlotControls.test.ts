// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCliTestApp } from '@/layers/apps/create-app';
import { LayerProvider } from '@/layers/apps/web/context/layer-provider';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { AudioRuntimeFeature } from '@/layers/shared/utils/audio-runtime-capabilities';
import { LoopSlotControls } from './LoopSlotControls';

vi.mock('./LoopSlotControls.css', () => ({
  clearButton: 'clearButton',
  container: 'container',
  error: 'error',
  inputButton: 'inputButton',
  inputControls: 'inputControls',
  monitoringActive: 'monitoringActive',
  overdubButton: 'overdubButton',
  primaryButton: 'primaryButton',
  settingLabel: 'settingLabel',
  settingSelect: 'settingSelect',
  slot: 'slot',
  slotActions: 'slotActions',
  slotGrid: 'slotGrid',
  slotHeader: 'slotHeader',
  slotSettings: 'slotSettings',
  state: 'state',
}));

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
});

describe('LoopSlotControls', () => {
  it('실시간 입력과 루프가 지원되지 않으면 관련 컨트롤을 비활성화한다', async () => {
    const baseApp = createCliTestApp();
    await baseApp.commandExecutor.execute({ trackId: TRACK_ID, type: AudioCommandType.ADD_TRACK });
    const loopSlot = baseApp.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0];
    if (!loopSlot) {
      throw new Error('테스트 루프 슬롯이 없습니다.');
    }
    const app = {
      ...baseApp,
      audioRuntimeCapabilities: {
        ...baseApp.audioRuntimeCapabilities,
        features: {
          ...baseApp.audioRuntimeCapabilities.features,
          [AudioRuntimeFeature.LIVE_INPUT]: { blockers: [], status: 'unsupported' as const },
          [AudioRuntimeFeature.LIVE_LOOP]: { blockers: [], status: 'unsupported' as const },
        },
      },
    };
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() =>
      root.render(
        createElement(
          LayerProvider,
          { app },
          createElement(LoopSlotControls, { loopSlots: [loopSlot], trackId: TRACK_ID })
        )
      )
    );

    expect([...host.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
    expect([...host.querySelectorAll('select')].every(select => select.disabled)).toBe(true);
    expect(host.querySelector('section')?.title).toContain('현재 runtime에 구현되지 않음');
  });

  it('재생 중인 슬롯의 DUB 버튼을 오버더빙 명령으로 변환한다', async () => {
    const baseApp = createCliTestApp();
    const app = {
      ...baseApp,
      audioRuntimeCapabilities: {
        ...baseApp.audioRuntimeCapabilities,
        features: {
          ...baseApp.audioRuntimeCapabilities.features,
          [AudioRuntimeFeature.LIVE_INPUT]: { blockers: [], status: 'available' as const },
          [AudioRuntimeFeature.LIVE_LOOP]: { blockers: [], status: 'available' as const },
        },
      },
    };
    await app.commandExecutor.execute({ trackId: TRACK_ID, type: AudioCommandType.ADD_TRACK });
    const loopSlot = app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0];
    if (!loopSlot) {
      throw new Error('테스트 루프 슬롯이 없습니다.');
    }
    app.session.getState().updateLoopSlot({
      slotId: loopSlot.id,
      trackId: TRACK_ID,
      updates: { sourceId: SOURCE_ID, state: 'playing' },
    });
    const playingLoopSlot = app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0];
    if (!playingLoopSlot) {
      throw new Error('재생 중인 테스트 루프 슬롯이 없습니다.');
    }
    const execute = vi.spyOn(app.commandExecutor, 'execute').mockResolvedValue(undefined);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() =>
      root.render(
        createElement(
          LayerProvider,
          { app },
          createElement(LoopSlotControls, { loopSlots: [playingLoopSlot], trackId: TRACK_ID })
        )
      )
    );
    const overdubButton = [...host.querySelectorAll('button')].find(button => button.textContent === 'DUB');
    if (!overdubButton) {
      throw new Error('오버더빙 버튼이 없습니다.');
    }

    await act(async () => overdubButton.click());

    expect(execute).toHaveBeenCalledWith({
      slotId: loopSlot.id,
      trackId: TRACK_ID,
      type: AudioCommandType.ARM_LOOP_OVERDUB,
    });
    expect(host.textContent).toContain('playing · 1L');
  });
});
