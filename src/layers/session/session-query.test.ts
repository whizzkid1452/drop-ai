import { describe, expect, it, vi } from 'vitest';
import { createSessionStore } from './session';
import { createSessionQuery } from './session-query';

const PROJECT_METADATA = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '테스트 프로젝트',
  revision: 0,
};

function createTestSessionStore() {
  return createSessionStore({ initialProjectMetadata: PROJECT_METADATA });
}

describe('SessionQuery', () => {
  it('Session action을 Apps에 노출하지 않는다', () => {
    const query = createSessionQuery(createTestSessionStore());

    expect(query.getState()).not.toHaveProperty('setTempo');
    expect(query.getState()).not.toHaveProperty('setAgentStatus');
  });

  it('Session이 바뀌기 전에는 같은 snapshot을 반환한다', () => {
    const query = createSessionQuery(createTestSessionStore());

    expect(query.getState()).toBe(query.getState());
  });

  it('Session 변경을 구독자에게 전달하고 새 snapshot을 반환한다', () => {
    const sessionStore = createTestSessionStore();
    const query = createSessionQuery(sessionStore);
    const previousSnapshot = query.getState();
    const listener = vi.fn();
    query.subscribe(listener);

    sessionStore.getState().setTempo(140);

    expect(listener).toHaveBeenCalledOnce();
    expect(query.getState()).not.toBe(previousSnapshot);
    expect(query.getState().tempo).toBe(140);
  });

  it('Map snapshot 변경이 Session 원본에 영향을 주지 않는다', () => {
    const sessionStore = createTestSessionStore();
    const query = createSessionQuery(sessionStore);
    const snapshotTracks = query.getState().tracks as Map<string, unknown>;

    snapshotTracks.set('외부 변경', {});

    expect(sessionStore.getState().tracks.has('외부 변경')).toBe(false);
  });
});
