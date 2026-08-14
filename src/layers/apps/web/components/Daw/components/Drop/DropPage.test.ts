// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DropPage } from './DropPage';

const routeMocks = vi.hoisted(() => ({ navigate: vi.fn() }));
const loadProjectMocks = vi.hoisted(() => ({ onProjectLoaded: undefined as (() => void) | undefined }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => routeMocks.navigate,
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useAgentRuntimeCommands: () => ({ execute: vi.fn() }),
}));

vi.mock('@/layers/apps/web/components/Auth/AccountControl', () => ({
  AccountControl: () => null,
}));

vi.mock('@/layers/apps/web/components/common/FileDrop/AudioFileDrop', () => ({
  AudioFileDrop: () => null,
}));

vi.mock('../LoadProjectControl/LoadProjectControl', () => ({
  LoadProjectControl: ({ onProjectLoaded }: { readonly onProjectLoaded?: () => void }) => {
    loadProjectMocks.onProjectLoaded = onProjectLoaded;
    return createElement('div', { 'data-testid': 'project-loader' });
  },
}));

vi.mock('./DropPage.css.ts', () => ({
  accountControl: 'accountControl',
  cardGroup: 'cardGroup',
  container: 'container',
}));

const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  loadProjectMocks.onProjectLoaded = undefined;
  vi.clearAllMocks();
});

describe('DropPage 원격 프로젝트 불러오기', () => {
  it('프로젝트 목록을 표시하고 불러온 뒤 편집 화면으로 이동한다', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(DropPage)));
    act(() => loadProjectMocks.onProjectLoaded?.());

    expect(host.querySelector('[data-testid="project-loader"]')).not.toBeNull();
    expect(routeMocks.navigate).toHaveBeenCalledWith('/daw', { replace: true });
  });
});
