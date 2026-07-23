// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DawHeader } from './DawHeader';

const componentMocks = vi.hoisted(() => ({
  audioRuntimeStatus: vi.fn(() => null),
  saveProjectButton: vi.fn(() => null),
  loadProjectControl: vi.fn(() => null),
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

vi.mock('./TempoMetadataControl', () => ({
  TempoMetadataControl: () => null,
}));

vi.mock('../../DawPage.css.ts', () => ({
  header: 'header',
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
  componentMocks.saveProjectButton.mockClear();
  componentMocks.loadProjectControl.mockClear();
});

describe('DawHeader', () => {
  it('브라우저 오디오 상태를 헤더에 연결한다', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(DawHeader, { trackCount: 2 })));

    expect(componentMocks.audioRuntimeStatus).toHaveBeenCalledTimes(1);
    expect(componentMocks.saveProjectButton).toHaveBeenCalledTimes(1);
    expect(componentMocks.loadProjectControl).toHaveBeenCalledTimes(1);
  });
});
