// @vitest-environment happy-dom

import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DawPage } from './DawPage';

const layerMocks = {
  tempo: 120,
  tracks: new Map<string, { regions: Array<{ duration: number; startTime: number }> }>(),
};

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  usePlaybackClock: () => ({ getCurrentTime: () => 0 }),
  useSession: (selector: (state: typeof layerMocks) => unknown) => selector(layerMocks),
}));

vi.mock('./components/DawHeader/DawHeader', () => ({
  DawHeader: ({ onViewChange }: { onViewChange: (view: 'editor' | 'mixer') => void }) =>
    createElement('button', { 'aria-label': 'Open Mixer', onClick: () => onViewChange('mixer') }, 'Mixer'),
}));

vi.mock('./components/MixerView/MixerView', () => ({
  MixerView: () => createElement('div', { 'data-testid': 'mixer-view' }),
}));

vi.mock('./components/TrackList/TrackList', () => ({
  TrackList: ({ onTrackSelect }: { onTrackSelect: (trackId: string) => void }) =>
    createElement(
      'button',
      {
        'aria-label': '두 번째 Track 선택',
        onClick: () => onTrackSelect('track-2'),
      },
      '두 번째 Track 선택'
    ),
}));

vi.mock('./components/Terminals/Terminal', () => ({
  Terminal: () => null,
}));

vi.mock('./components/TrackInfoSidebar/TrackInfoSidebar', () => ({
  TrackInfoSidebar: ({ selectedTrackId }: { selectedTrackId: string | null }) =>
    createElement('div', { 'data-selected-track-id': selectedTrackId ?? '', 'data-testid': 'track-inspector' }),
}));

vi.mock('./components/TimeRuler/TimeRuler', () => ({
  TimeRuler: () => null,
}));

vi.mock('./components/TempoMeterRuler/TempoMeterRuler', () => ({
  TempoMeterRuler: () => null,
}));

vi.mock('./components/MarkerRangeRuler/MarkerRangeRuler', () => ({
  MarkerRangeRuler: () => null,
}));

vi.mock('./components/TimelineGridControls/TimelineGridControls', () => ({
  TimelineGridControls: () => null,
}));

vi.mock('./components/TimelineNavigationControls/TimelineNavigationControls', () => ({
  TimelineNavigationControls: () => null,
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
  layerMocks.tracks = new Map();
});

describe('DawPage 타임라인 스크롤', () => {
  it('프로젝트 길이와 배율로 계산한 타임라인 폭을 화면에 전달한다', () => {
    layerMocks.tracks = new Map([
      [
        'track-1',
        {
          regions: [{ duration: 49, startTime: 0 }],
        },
      ],
    ]);

    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(DawPage)));

    const mainContent = host.querySelector<HTMLElement>('.mainContent');

    expect(mainContent?.style.getPropertyValue('--timeline-content-width')).toBe('4864px');
  });

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

describe('DawPage Track 선택', () => {
  it('첫 Track을 기본 선택하고 TrackList 선택을 Inspector에 전달한다', () => {
    layerMocks.tracks = new Map([
      ['track-1', { regions: [] }],
      ['track-2', { regions: [] }],
    ]);
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(DawPage)));

    expect(host.querySelector('[data-testid="track-inspector"]')).toBeNull();

    const inspectorToggle = host.querySelector<HTMLButtonElement>('button[aria-label="Open track inspector"]');
    act(() => inspectorToggle?.click());

    const inspector = host.querySelector<HTMLElement>('[data-testid="track-inspector"]');
    const selectSecondTrack = host.querySelector<HTMLButtonElement>('button[aria-label="두 번째 Track 선택"]');

    expect(inspector?.dataset.selectedTrackId).toBe('track-1');

    act(() => selectSecondTrack?.click());

    expect(inspector?.dataset.selectedTrackId).toBe('track-2');
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

describe('DawPage 작업 화면 전환', () => {
  it('Header의 Mixer 선택 뒤 Timeline 대신 Mixer를 표시한다', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    mountedRoots.push(root);

    act(() => root.render(createElement(DawPage)));
    expect(host.querySelector('[data-testid="mixer-view"]')).toBeNull();

    act(() => host.querySelector<HTMLButtonElement>('[aria-label="Open Mixer"]')?.click());

    expect(host.querySelector('[data-testid="mixer-view"]')).not.toBeNull();
    expect(host.querySelector('.timelineHeader')).toBeNull();
  });
});
