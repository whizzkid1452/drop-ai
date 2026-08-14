// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MediaSourceState } from '@/layers/queries/media-source-query';
import { AudioCommandType, type AudioCommand } from '@/types/audioCommand.schema';
import { MediaSourcePanel } from './MediaSourcePanel';

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const UNUSED_SOURCE_ID = '22222222-2222-4222-8222-222222222222';
const execute = vi.fn<(command: AudioCommand) => Promise<unknown>>().mockResolvedValue(undefined);
let projectRevision = 0;
let sources: readonly MediaSourceState[] = [];

vi.mock('@/layers/apps/web/context/layer-hooks', () => ({
  useCommandExecutor: () => ({ execute }),
  useMediaSourceQuery: () => ({ readSources: () => sources }),
  useSession: (selector: (state: { project: { revision: number } }) => unknown) =>
    selector({ project: { revision: projectRevision } }),
}));

vi.mock('./MediaSourcePanel.css.ts', () => ({
  actionButton: 'actionButton',
  card: 'card',
  cardHeader: 'cardHeader',
  codecBadge: 'codecBadge',
  container: 'container',
  details: 'details',
  emptyState: 'emptyState',
  errorMessage: 'errorMessage',
  field: 'field',
  header: 'header',
  headerActions: 'headerActions',
  list: 'list',
  metadata: 'metadata',
  primaryAction: 'primaryAction',
  searchInput: 'searchInput',
  status: 'status',
  statusBadge: 'statusBadge',
  tagActions: 'tagActions',
  tagInput: 'tagInput',
  title: 'title',
}));

const mountedRoots: Root[] = [];

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createSource(overrides: Partial<MediaSourceState> = {}): MediaSourceState {
  return {
    bwfMetadata: null,
    byteLength: 1_024,
    codec: 'wav',
    codecSupport: 'probably',
    derivation: null,
    durationSeconds: 1,
    fileName: 'voice.wav',
    id: SOURCE_ID,
    isInUse: true,
    loopSlotIds: [],
    mimeType: 'audio/wav',
    objectUrl: 'blob:voice',
    regionIds: ['33333333-3333-4333-8333-333333333333'],
    tags: ['vocal'],
    transientPositionsSeconds: [],
    ...overrides,
  };
}

function renderPanel(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push(root);
  act(() => root.render(createElement(MediaSourcePanel)));
  return host;
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) {
    throw new Error('HTML input value setter를 찾을 수 없습니다.');
  }
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(() => {
  act(() => mountedRoots.splice(0).forEach(root => root.unmount()));
  document.body.replaceChildren();
  execute.mockReset().mockResolvedValue(undefined);
  projectRevision = 0;
  sources = [];
});

describe('MediaSourcePanel', () => {
  it('파일명과 tag로 Source를 검색한다', () => {
    sources = [createSource(), createSource({ fileName: 'guitar.flac', id: UNUSED_SOURCE_ID, tags: ['instrument'] })];
    const host = renderPanel();
    const search = host.querySelector<HTMLInputElement>('[aria-label="Source 검색"]');
    if (!search) {
      throw new Error('Source 검색 입력을 찾을 수 없습니다.');
    }

    setInputValue(search, 'instrument');

    expect(host.querySelectorAll('[data-source-id]')).toHaveLength(1);
    expect(host.textContent).toContain('guitar.flac');
    expect(host.textContent).not.toContain('voice.wav');
  });

  it('tag 저장과 Source 미리듣기 명령을 실행한다', async () => {
    sources = [createSource()];
    const host = renderPanel();
    const tagInput = host.querySelector<HTMLInputElement>('[aria-label="voice.wav 태그"]');
    if (!tagInput) {
      throw new Error('Source tag 입력을 찾을 수 없습니다.');
    }
    setInputValue(tagInput, ' vocal, lead, vocal ');

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="voice.wav 태그 저장"]')?.click();
    });
    expect(execute).toHaveBeenCalledWith({
      type: AudioCommandType.SET_SOURCE_TAGS,
      sourceId: SOURCE_ID,
      tags: ['vocal', 'lead'],
    });

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="voice.wav 미리듣기"]')?.click();
    });
    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.AUDITION_SOURCE, sourceId: SOURCE_ID });

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="voice.wav 미리듣기 중지"]')?.click();
    });
    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.STOP_SOURCE_AUDITION });
  });

  it('참조가 없는 Source만 정리하고 목록을 갱신한다', async () => {
    sources = [createSource(), createSource({ id: UNUSED_SOURCE_ID, isInUse: false, regionIds: [] })];
    execute.mockImplementation(async command => {
      if (command.type === AudioCommandType.CLEANUP_UNUSED_SOURCES) {
        sources = sources.filter(source => source.id !== UNUSED_SOURCE_ID);
        return { removedSourceIds: [UNUSED_SOURCE_ID] };
      }
      return undefined;
    });
    const host = renderPanel();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="미사용 Source 1개 정리"]')?.click();
    });

    expect(execute).toHaveBeenCalledWith({ type: AudioCommandType.CLEANUP_UNUSED_SOURCES });
    expect(host.querySelectorAll('[data-source-id]')).toHaveLength(1);
    expect(host.textContent).toContain('1개 Source를 정리했습니다.');
  });
});
