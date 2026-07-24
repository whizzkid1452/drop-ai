// @vitest-environment happy-dom

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DawPage } from './DawPage';

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useSession: (selector: (state: { tracks: Map<string, never> }) => unknown) =>
    selector({
      tracks: new Map<string, never>(),
    }),
}));

vi.mock('./components/DawHeader/DawHeader', () => ({
  DawHeader: () => null,
}));

vi.mock('./components/TrackList/TrackList', () => ({
  TrackList: () => createElement('div', { 'data-testid': 'track-list' }),
}));

vi.mock('./components/Terminals/Terminal', () => ({
  Terminal: () => null,
}));

vi.mock('./components/TrackInfoSidebar/TrackInfoSidebar', () => ({
  TrackInfoSidebar: () => null,
}));

vi.mock('./components/TimeRuler/TimeRuler', () => ({
  TimeRuler: () => null,
}));

vi.mock('./DawPage.css.ts', () => ({
  cliPanel: 'cliPanel',
  cliPanelCollapsed: 'cliPanelCollapsed',
  cliPanelResizing: 'cliPanelResizing',
  cliToggleButton: 'cliToggleButton',
  cliToggleButtonOpen: 'cliToggleButtonOpen',
  cliToggleButtonResizing: 'cliToggleButtonResizing',
  container: 'container',
  leftPanel: 'leftPanel',
  leftPanelCollapsed: 'leftPanelCollapsed',
  leftToggleButton: 'leftToggleButton',
  leftToggleButtonOpen: 'leftToggleButtonOpen',
  mainContent: 'mainContent',
  resizeHandle: 'resizeHandle',
  timelineHeader: 'timelineHeader',
  timelineMeta: 'timelineMeta',
  timelineRuler: 'timelineRuler',
  trackCount: 'trackCount',
  trackHeaderRuler: 'trackHeaderRuler',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  act(() => {
    mountedRoots.splice(0).forEach(root => root.unmount());
  });
  document.body.replaceChildren();
});

describe('DawPage 타임라인 스크롤', () => {
  it('Shift와 세로 휠 입력을 가로 스크롤로 변환한다', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(DawPage)));

    const mainContent = host.querySelector<HTMLElement>('.mainContent');
    if (!mainContent) {
      throw new Error('타임라인 스크롤 영역을 찾지 못했습니다.');
    }

    Object.defineProperties(mainContent, {
      clientWidth: { configurable: true, value: 500 },
      scrollWidth: { configurable: true, value: 900 },
    });

    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperties(wheelEvent, {
      deltaX: { configurable: true, value: 0 },
      deltaY: { configurable: true, value: 120 },
      shiftKey: { configurable: true, value: true },
    });

    act(() => {
      mainContent.dispatchEvent(wheelEvent);
    });

    expect(mainContent.scrollLeft).toBe(120);
    expect(wheelEvent.defaultPrevented).toBe(true);
  });
});

describe('DawPage Terminal 리사이즈', () => {
  it('리사이즈 중에는 Terminal 버튼의 위치 transition을 끈다', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(DawPage)));

    const resizeHandle = host.querySelector('.resizeHandle');
    const terminalToggle = host.querySelector('.cliToggleButton');
    if (!resizeHandle || !terminalToggle) {
      throw new Error('Terminal 리사이즈 제어를 찾지 못했습니다.');
    }

    act(() => {
      resizeHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 600 }));
    });

    expect(terminalToggle.classList.contains('cliToggleButtonResizing')).toBe(true);
  });
});
