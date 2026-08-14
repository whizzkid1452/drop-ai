// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCliTestApp } from '@/layers/apps/create-app';
import { LayerProvider } from '@/layers/apps/web/context/layer-provider';
import { AudioCommandType } from '@/layers/shared/types/audioCommand.schema';
import { createSessionStore } from '@/layers/session/session';
import { CueControl } from './CueControl';

vi.mock('./CueControl.css', () => ({
  backdrop: 'backdrop',
  clipButton: 'clipButton',
  dialog: 'dialog',
  empty: 'empty',
  error: 'error',
  grid: 'grid',
  header: 'header',
  performance: 'performance',
  performanceActions: 'performanceActions',
  performances: 'performances',
  recordingDot: 'recordingDot',
  trackName: 'trackName',
  trackRow: 'trackRow',
  transport: 'transport',
  trigger: 'trigger',
}));

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const PERFORMANCE_ID = '33333333-3333-4333-8333-333333333333';
const EVENT_ID = '44444444-4444-4444-8444-444444444444';
const mountedRoots: Root[] = [];

function createTestApp() {
  const sessionStore = createSessionStore({
    initialProjectMetadata: {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: '테스트 프로젝트',
      revision: 0,
    },
  });
  return { app: createCliTestApp({ sessionStore }), sessionStore };
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
});

describe('CueControl', () => {
  it('Clip 실행과 Cue 기록 명령을 UI에서 전달한다', async () => {
    const { app, sessionStore } = createTestApp();
    await app.commandExecutor.execute({ trackId: TRACK_ID, type: AudioCommandType.ADD_TRACK });
    const slot = app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0];
    if (!slot) {
      throw new Error('테스트 Clip Slot이 없습니다.');
    }
    sessionStore.getState().updateLoopSlot({
      slotId: slot.id,
      trackId: TRACK_ID,
      updates: { sourceId: SOURCE_ID, state: 'stopped' },
    });
    const execute = vi.spyOn(app.commandExecutor, 'execute').mockResolvedValue(undefined);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    act(() => root.render(createElement(LayerProvider, { app }, createElement(CueControl))));

    act(() => host.querySelector<HTMLButtonElement>('button')?.click());
    const recordButton = [...document.body.querySelectorAll('button')].find(
      button => button.textContent === 'RECORD CUE'
    );
    const clipButton = document.body.querySelector<HTMLButtonElement>(`[aria-label="${slot.name} stopped"]`);
    await act(async () => recordButton?.click());
    await act(async () => clipButton?.click());

    expect(execute).toHaveBeenNthCalledWith(1, { type: AudioCommandType.START_CUE_RECORDING });
    expect(execute).toHaveBeenNthCalledWith(2, {
      slotId: slot.id,
      trackId: TRACK_ID,
      type: AudioCommandType.TRIGGER_LOOP_SLOT,
    });
  });

  it('저장된 Cue 연주를 arrangement 변환과 삭제 명령으로 전달한다', async () => {
    const { app, sessionStore } = createTestApp();
    await app.commandExecutor.execute({ trackId: TRACK_ID, type: AudioCommandType.ADD_TRACK });
    const slot = app.session.getState().tracks.get(TRACK_ID)?.loopSlots?.[0];
    if (!slot) {
      throw new Error('테스트 Clip Slot이 없습니다.');
    }
    sessionStore.getState().setCueState({
      performances: [
        {
          createdAt: '2026-08-14T00:00:00.000Z',
          events: [
            {
              durationQuarterNotes: 4,
              id: EVENT_ID,
              slotId: slot.id,
              startQuarterNotes: 0,
              trackId: TRACK_ID,
            },
          ],
          id: PERFORMANCE_ID,
          name: 'Verse take',
        },
      ],
    });
    const execute = vi.spyOn(app.commandExecutor, 'execute').mockResolvedValue(undefined);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);
    act(() => root.render(createElement(LayerProvider, { app }, createElement(CueControl))));

    act(() => host.querySelector<HTMLButtonElement>('button')?.click());
    const arrangeButton = [...document.body.querySelectorAll('button')].find(
      button => button.textContent === 'ARRANGE'
    );
    const deleteButton = [...document.body.querySelectorAll('button')].find(button => button.textContent === 'DELETE');
    await act(async () => arrangeButton?.click());
    await act(async () => deleteButton?.click());

    expect(execute).toHaveBeenNthCalledWith(1, {
      performanceId: PERFORMANCE_ID,
      type: AudioCommandType.CONVERT_CUE_TO_ARRANGEMENT,
    });
    expect(execute).toHaveBeenNthCalledWith(2, {
      performanceId: PERFORMANCE_ID,
      type: AudioCommandType.DELETE_CUE_PERFORMANCE,
    });
  });
});
