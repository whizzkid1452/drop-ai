// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCliTestApp, type AppInstance } from '@/layers/apps/create-app';
import { LayerProvider } from '@/layers/apps/web/context/layer-provider';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { SessionLifecycleControl } from './SessionLifecycleControl';

vi.mock('./SessionLifecycleControl.css', () => ({
  backdrop: 'backdrop',
  closeButton: 'closeButton',
  content: 'content',
  dialog: 'dialog',
  dialogHeader: 'dialogHeader',
  empty: 'empty',
  error: 'error',
  hiddenInput: 'hiddenInput',
  inlineActions: 'inlineActions',
  inlineForm: 'inlineForm',
  list: 'list',
  listRow: 'listRow',
  panel: 'panel',
  recoveryCard: 'recoveryCard',
  recoveryDot: 'recoveryDot',
  sectionHeader: 'sectionHeader',
  trigger: 'trigger',
}));

const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const RECOVERY_PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function renderControl(app: AppInstance) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(LayerProvider, { app }, createElement(SessionLifecycleControl))));
  const trigger = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('Session'));
  act(() => trigger?.click());
}

function setValue(element: HTMLInputElement | HTMLSelectElement, value: string): void {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('SessionLifecycleControl', () => {
  it('Snapshot과 Track Template 생성 명령을 연결한다', async () => {
    const app = createCliTestApp();
    await app.commandExecutor.execute({ trackId: TRACK_ID, type: AudioCommandType.ADD_TRACK });
    const execute = vi.spyOn(app.commandExecutor, 'execute').mockResolvedValue(undefined);
    renderControl(app);

    const snapshotName = document.querySelector<HTMLInputElement>('input[aria-label="Snapshot name"]');
    const templateKind = document.querySelector<HTMLSelectElement>('select[aria-label="Template kind"]');
    const templateName = document.querySelector<HTMLInputElement>('input[aria-label="Template name"]');
    if (!snapshotName || !templateKind || !templateName) {
      throw new Error('Session lifecycle 입력 UI가 없습니다.');
    }
    act(() => setValue(snapshotName, 'Before mix'));
    await act(async () => {
      document.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
      [...document.querySelectorAll('button')].find(button => button.textContent === 'Create snapshot')?.click();
    });
    act(() => setValue(templateKind, 'track'));
    act(() => setValue(templateName, 'Vocal strip'));
    await act(async () => {
      [...document.querySelectorAll('button')].find(button => button.textContent === 'Save template')?.click();
    });

    expect(execute).toHaveBeenCalledWith({ name: 'Before mix', type: AudioCommandType.CREATE_NAMED_SNAPSHOT });
    expect(execute).toHaveBeenCalledWith({
      kind: 'track',
      name: 'Vocal strip',
      trackId: TRACK_ID,
      type: AudioCommandType.CREATE_PROJECT_TEMPLATE,
    });
  });

  it('Crash checkpoint에서 프로젝트를 불러오고 알림을 제거한다', async () => {
    const baseApp = createCliTestApp();
    const checkpoint = {
      projectId: RECOVERY_PROJECT_ID,
      projectName: 'Recovered session',
      projectRevision: 4,
      savedAtEpochMilliseconds: 1,
      schemaVersion: 19 as const,
    };
    const app: AppInstance = {
      ...baseApp,
      sessionRecovery: {
        getSnapshot: () => checkpoint,
        subscribe: () => () => undefined,
      },
    };
    const execute = vi.spyOn(app.commandExecutor, 'execute').mockResolvedValue(undefined);
    renderControl(app);

    await act(async () => {
      [...document.querySelectorAll('button')].find(button => button.textContent === 'Recover')?.click();
    });

    expect(execute).toHaveBeenNthCalledWith(1, {
      projectId: RECOVERY_PROJECT_ID,
      type: AudioCommandType.LOAD_PROJECT,
    });
    expect(execute).toHaveBeenNthCalledWith(2, {
      projectId: RECOVERY_PROJECT_ID,
      type: AudioCommandType.DISMISS_SESSION_RECOVERY,
    });
  });
});
