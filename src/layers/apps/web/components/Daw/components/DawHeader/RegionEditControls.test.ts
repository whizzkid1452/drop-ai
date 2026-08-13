// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { RegionEditControls } from './RegionEditControls';

const layerMocks = vi.hoisted(() => ({
  editorState: {
    clipboard: { entries: [], pasteCount: 0 },
    selection: {
      editPointSeconds: 3,
      range: null,
      regions: [
        {
          regionId: '22222222-2222-4222-8222-222222222222',
          trackId: '11111111-1111-4111-8111-111111111111',
        },
      ],
      trackIds: ['11111111-1111-4111-8111-111111111111'],
    },
  },
  execute: vi.fn<(command: AudioCommand) => Promise<void>>().mockResolvedValue(undefined),
  tracks: new Map([
    [
      '11111111-1111-4111-8111-111111111111',
      {
        id: '11111111-1111-4111-8111-111111111111',
        regions: [
          {
            fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
            fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
            id: '22222222-2222-4222-8222-222222222222',
            sourceStartTime: 1,
            startTime: 1,
            duration: 3,
          },
          {
            fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
            fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
            id: '33333333-3333-4333-8333-333333333333',
            sourceStartTime: 0,
            startTime: 3,
            duration: 2,
          },
        ],
      },
    ],
  ]),
}));

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute: layerMocks.execute }),
  useEditorRuntimeState: () => layerMocks.editorState,
  useSession: (selector: (state: { tracks: typeof layerMocks.tracks }) => unknown) =>
    selector({ tracks: layerMocks.tracks }),
}));

vi.mock('./RegionEditControls.css.ts', () => ({
  button: 'button',
  buttonGroup: 'buttonGroup',
  container: 'container',
  summary: 'summary',
}));

const mountedRoots: Root[] = [];
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderControls(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(RegionEditControls)));
  return host;
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  layerMocks.execute.mockClear();
  layerMocks.editorState.selection.regions.splice(1);
});

describe('RegionEditControls', () => {
  it.each([
    ['Region 복사', { type: AudioCommandType.COPY_SELECTED_REGIONS }],
    ['Region 잘라내기', { type: AudioCommandType.CUT_SELECTED_REGIONS }],
    ['Region 복제', { type: AudioCommandType.DUPLICATE_SELECTED_REGIONS, offsetSeconds: 1 }],
    ['Region 앞으로 nudge', { type: AudioCommandType.NUDGE_SELECTED_REGIONS, deltaSeconds: 0.1 }],
    [
      'Region 시작을 edit point에 정렬',
      { type: AudioCommandType.ALIGN_SELECTED_REGIONS, edge: 'start', targetTimeSeconds: 3 },
    ],
  ] as const)('%s 버튼을 AudioCommand로 변환한다', async (label, command) => {
    const host = renderControls();

    await act(async () => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith(command);
  });

  it('선택한 단일 Region을 원본 안에서 slip한다', async () => {
    const host = renderControls();

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Region Source 앞으로 slip"]')?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      type: AudioCommandType.SLIP_REGION,
      regionId: '22222222-2222-4222-8222-222222222222',
      sourceStartTimeSeconds: 1.1,
      trackId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it.each([
    ['Region 정규화', { type: AudioCommandType.NORMALIZE_SELECTED_REGIONS, targetPeak: 0.98 }],
    ['Region 뒤집기', { type: AudioCommandType.REVERSE_SELECTED_REGIONS }],
    [
      'Region 무음 제거',
      { type: AudioCommandType.STRIP_SILENCE_SELECTED_REGIONS, minimumSilenceSeconds: 0.2, thresholdDb: -60 },
    ],
  ] as const)('%s 버튼을 AudioCommand로 변환한다', async (label, command) => {
    const host = renderControls();

    await act(async () => host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith(command);
  });

  it('겹친 Region 두 개를 시간 순서의 Crossfade 명령으로 변환한다', async () => {
    layerMocks.editorState.selection.regions.push({
      regionId: '33333333-3333-4333-8333-333333333333',
      trackId: '11111111-1111-4111-8111-111111111111',
    });
    const host = renderControls();

    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Region Crossfade 생성"]')?.click());

    expect(layerMocks.execute).toHaveBeenCalledWith({
      type: AudioCommandType.CREATE_REGION_CROSSFADE,
      crossfadeId: expect.any(String),
      curve: 'linear',
      fadeInRegionId: '33333333-3333-4333-8333-333333333333',
      fadeOutRegionId: '22222222-2222-4222-8222-222222222222',
      trackId: '11111111-1111-4111-8111-111111111111',
    });
  });
});
