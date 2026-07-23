// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DawHeader } from './DawHeader';

const componentMocks = vi.hoisted(() => ({
  audioRuntimeStatus: vi.fn(() => null),
  masterVolumeControl: vi.fn(() => null),
  saveProjectButton: vi.fn(() => null),
  loadProjectControl: vi.fn(() => null),
  undoRedoControls: vi.fn(() => null),
  playbackControls: vi.fn(() => null),
}));

vi.mock('./AudioRuntimeStatus', () => ({
  AudioRuntimeStatus: componentMocks.audioRuntimeStatus,
}));

vi.mock('../ExportButton/ExportButton', () => ({
  ExportButton: () => null,
}));

vi.mock('../SaveProjectButton/SaveProjectButton', () => ({
  SaveProjectButton: componentMocks.saveProjectButton,
}));

vi.mock('../LoadProjectControl/LoadProjectControl', () => ({
  LoadProjectControl: componentMocks.loadProjectControl,
}));

vi.mock('../UndoRedoControls/UndoRedoControls', () => ({
  UndoRedoControls: componentMocks.undoRedoControls,
}));

vi.mock('../PlaybackControls/PlaybackControls', () => ({
  PlaybackControls: componentMocks.playbackControls,
}));

vi.mock('./TempoMetadataControl', () => ({
  TempoMetadataControl: () => null,
}));

vi.mock('./MasterVolumeControl', () => ({
  MasterVolumeControl: componentMocks.masterVolumeControl,
}));

vi.mock('../../DawPage.css.ts', () => ({
  header: 'header',
  headerIdentity: 'headerIdentity',
  productName: 'productName',
  workspaceName: 'workspaceName',
  projectBar: 'projectBar',
  transportBar: 'transportBar',
  runtimeSection: 'runtimeSection',
  transportSection: 'transportSection',
  statusSection: 'statusSection',
  projectActions: 'projectActions',
  headerRight: 'headerRight',
  title: 'title',
  trackCount: 'trackCount',
}));

vi.mock('@/styles/global.css', () => ({
  wave: 'wave',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  componentMocks.audioRuntimeStatus.mockClear();
  componentMocks.masterVolumeControl.mockClear();
  componentMocks.saveProjectButton.mockClear();
  componentMocks.loadProjectControl.mockClear();
  componentMocks.undoRedoControls.mockClear();
  componentMocks.playbackControls.mockClear();
});

describe('DawHeader', () => {
  it('브라우저 오디오 상태를 헤더에 연결한다', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(DawHeader, { trackCount: 2 })));

    expect(componentMocks.audioRuntimeStatus).toHaveBeenCalledTimes(1);
    expect(componentMocks.masterVolumeControl).toHaveBeenCalledTimes(1);
    expect(componentMocks.saveProjectButton).toHaveBeenCalledTimes(1);
    expect(componentMocks.loadProjectControl).toHaveBeenCalledTimes(1);
    expect(componentMocks.undoRedoControls).toHaveBeenCalledTimes(1);
    expect(componentMocks.playbackControls).toHaveBeenCalledWith({ layout: 'inline' }, undefined);
  });
});
