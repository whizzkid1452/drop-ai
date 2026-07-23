// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectSummary } from '@/layers/project-repository/i-project-repository';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { LoadProjectControl } from './LoadProjectControl';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT: ProjectSummary = {
  projectId: PROJECT_ID,
  name: '보컬 편집',
  revision: 2,
  savedAtEpochMilliseconds: 100,
};
const REFRESHED_PROJECT: ProjectSummary = {
  projectId: '22222222-2222-4222-8222-222222222222',
  name: '새로 저장한 프로젝트',
  revision: 0,
  savedAtEpochMilliseconds: 200,
};

const layerMocks = vi.hoisted(() => ({
  execute: vi.fn<(command: AudioCommand) => Promise<unknown>>(),
  listProjects: vi.fn<() => Promise<readonly ProjectSummary[]>>(),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useProjectCatalog: () => ({ listProjects: layerMocks.listProjects }),
}));

vi.mock('./LoadProjectControl.css.ts', () => ({
  button: 'button',
  container: 'container',
  error: 'error',
  select: 'select',
  status: 'status',
}));

const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function renderControl() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  await act(async () => root.render(createElement(LoadProjectControl)));
  return { host };
}

beforeEach(() => {
  layerMocks.execute.mockResolvedValue(undefined);
  layerMocks.listProjects.mockResolvedValue([PROJECT]);
});

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
  vi.clearAllMocks();
});

describe('LoadProjectControl', () => {
  it('저장된 프로젝트를 선택하면 LOAD_PROJECT를 실행한다', async () => {
    const { host } = await renderControl();
    const button = host.querySelector('button');
    const option = host.querySelector('option');

    expect(option?.textContent).toContain('보컬 편집');
    if (!button) {
      throw new Error('프로젝트 불러오기 버튼을 찾지 못했습니다.');
    }
    await act(async () => button.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({ type: AudioCommandType.LOAD_PROJECT, projectId: PROJECT_ID });
    expect(host.querySelector('[role="status"]')?.textContent).toBe('프로젝트를 불러왔습니다.');
  });

  it('저장된 프로젝트가 없으면 실행하지 않는다', async () => {
    layerMocks.listProjects.mockResolvedValue([]);
    const { host } = await renderControl();
    const button = host.querySelector('button');

    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(host.textContent).toContain('저장된 프로젝트 없음');
    expect(layerMocks.execute).not.toHaveBeenCalled();
  });

  it('불러오기 실패 이유를 표시한다', async () => {
    layerMocks.execute.mockRejectedValueOnce(new Error('오디오 원본 없음'));
    const { host } = await renderControl();
    const button = host.querySelector('button');
    if (!button) {
      throw new Error('프로젝트 불러오기 버튼을 찾지 못했습니다.');
    }

    await act(async () => button.click());

    expect(host.querySelector('[role="alert"]')?.textContent).toContain('오디오 원본 없음');
  });

  it('목록 새로고침으로 마운트 뒤 저장된 프로젝트를 다시 읽는다', async () => {
    layerMocks.listProjects.mockResolvedValueOnce([PROJECT]).mockResolvedValueOnce([PROJECT, REFRESHED_PROJECT]);
    const { host } = await renderControl();
    const refreshButton = [...host.querySelectorAll('button')].find(button =>
      button.textContent?.includes('목록 새로고침')
    );
    if (!refreshButton) {
      throw new Error('프로젝트 목록 새로고침 버튼을 찾지 못했습니다.');
    }

    await act(async () => refreshButton.click());

    expect(layerMocks.listProjects).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('새로 저장한 프로젝트');
  });
});
