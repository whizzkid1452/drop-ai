import { describe, expect, it, vi } from 'vitest';
import { CommandHistory, type CommandHistoryEntry } from './command-history';

function createEntry(label: string, actions: string[]): CommandHistoryEntry {
  return {
    label,
    undo: vi.fn(async () => {
      actions.push(`undo:${label}`);
    }),
    redo: vi.fn(async () => {
      actions.push(`redo:${label}`);
    }),
  };
}

describe('CommandHistory', () => {
  it('새 기록을 추가하면 Undo 가능 상태를 알린다', () => {
    const history = new CommandHistory();
    const listener = vi.fn();
    history.subscribe(listener);

    history.record(createEntry('tempo', []));

    expect(history.getSnapshot()).toEqual({ canRedo: false, canUndo: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Undo와 Redo 성공 뒤에만 기록을 반대 스택으로 이동한다', async () => {
    const actions: string[] = [];
    const history = new CommandHistory();
    history.record(createEntry('tempo', actions));

    await history.undo();
    expect(actions).toEqual(['undo:tempo']);
    expect(history.getSnapshot()).toEqual({ canRedo: true, canUndo: false });

    await history.redo();
    expect(actions).toEqual(['undo:tempo', 'redo:tempo']);
    expect(history.getSnapshot()).toEqual({ canRedo: false, canUndo: true });
  });

  it('Undo가 실패하면 같은 기록을 다시 시도할 수 있게 유지한다', async () => {
    const history = new CommandHistory();
    const cause = new Error('undo failed');
    history.record({
      label: 'tempo',
      undo: vi.fn().mockRejectedValue(cause),
      redo: vi.fn().mockResolvedValue(undefined),
    });

    await expect(history.undo()).rejects.toBe(cause);

    expect(history.getSnapshot()).toEqual({ canRedo: false, canUndo: true });
  });

  it('Undo 뒤 새 편집을 기록하면 기존 Redo 기록을 제거한다', async () => {
    const history = new CommandHistory();
    history.record(createEntry('tempo', []));
    await history.undo();

    history.record(createEntry('volume', []));

    expect(history.getSnapshot()).toEqual({ canRedo: false, canUndo: true });
  });

  it('기록이 없을 때 Undo와 Redo는 아무 작업도 하지 않는다', async () => {
    const history = new CommandHistory();

    await expect(history.undo()).resolves.toBeUndefined();
    await expect(history.redo()).resolves.toBeUndefined();
  });

  it('clear는 Undo와 Redo 기록을 모두 제거한다', async () => {
    const history = new CommandHistory();
    history.record(createEntry('tempo', []));
    await history.undo();

    history.clear();

    expect(history.getSnapshot()).toEqual({ canRedo: false, canUndo: false });
  });

  it('최근 편집 100개만 유지한다', async () => {
    const actions: string[] = [];
    const history = new CommandHistory();
    Array.from({ length: 101 }, (_, index) => index).forEach(index => {
      history.record(createEntry(String(index), actions));
    });

    for (let index = 0; index < 100; index += 1) {
      await history.undo();
    }

    expect(actions).toHaveLength(100);
    expect(actions).not.toContain('undo:0');
    expect(history.getSnapshot()).toEqual({ canRedo: true, canUndo: false });
  });
});
