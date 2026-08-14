import { describe, expect, it, vi } from 'vitest';
import { BrowserSessionRecoveryStore } from './session-recovery-query';

describe('BrowserSessionRecoveryStore', () => {
  it('마지막 자동 저장 프로젝트를 복구 checkpoint로 게시한다', () => {
    const store = new BrowserSessionRecoveryStore(undefined, () => 1234);
    const listener = vi.fn();
    store.subscribe(listener);

    store.record({ id: '11111111-1111-4111-8111-111111111111', name: 'Session', revision: 3 });

    expect(store.getSnapshot()).toMatchObject({
      projectName: 'Session',
      projectRevision: 3,
      savedAtEpochMilliseconds: 1234,
      schemaVersion: 18,
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('다른 프로젝트의 checkpoint는 제거하지 않는다', () => {
    const store = new BrowserSessionRecoveryStore();
    store.record({ id: '11111111-1111-4111-8111-111111111111', name: 'Session', revision: 3 });

    store.dismiss('22222222-2222-4222-8222-222222222222');

    expect(store.getSnapshot()).not.toBeNull();
  });
});
