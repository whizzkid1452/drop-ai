import { describe, expect, it, vi } from 'vitest';
import type { EditorRuntimeState } from '../shared/types/editor-runtime';
import { EditorQuery } from './editor-query';

const state: EditorRuntimeState = {
  clipboard: { entries: [], pasteCount: 0 },
  selection: { editPointSeconds: 0, range: null, regions: [], trackIds: [] },
};

describe('EditorQuery', () => {
  it('Controller의 immutable snapshot을 그대로 읽는다', () => {
    const source = { getState: vi.fn(() => state), subscribe: vi.fn(() => vi.fn()) };
    const query = new EditorQuery(source);

    expect(query.readState()).toBe(state);
  });

  it('runtime 상태 알림을 구독하고 해제한다', () => {
    const unsubscribeSource = vi.fn();
    const source = {
      getState: vi.fn(() => state),
      subscribe: vi.fn((listener: () => void) => {
        listener();
        return unsubscribeSource;
      }),
    };
    const listener = vi.fn();
    const query = new EditorQuery(source);

    const unsubscribe = query.subscribe(listener);
    unsubscribe();

    expect(listener).toHaveBeenCalledOnce();
    expect(unsubscribeSource).toHaveBeenCalledOnce();
  });
});
