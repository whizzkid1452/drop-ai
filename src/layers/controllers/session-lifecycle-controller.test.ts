import { describe, expect, it, vi } from 'vitest';
import { createProjectDocumentV17FromSession } from '../project-document-mapper/project-document-mapper';
import { createSessionStore, type TrackState } from '../session/session';
import type { ProjectDocumentSnapshot } from '../shared/types/project-document.schema';
import type { ProjectController } from './project-controller';
import { SessionLifecycleController } from './session-lifecycle-controller';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';
const CREATED_ID = '33333333-3333-4333-8333-333333333333';
const APPLIED_TRACK_ID = '44444444-4444-4444-8444-444444444444';

function createTrack(): TrackState {
  return {
    automationLanes: [],
    id: TRACK_ID,
    isMuted: false,
    isSoloed: false,
    loopSlots: [],
    midi: null,
    name: 'Vocal',
    pan: 0,
    pluginInstances: [],
    regions: [],
    status: [],
    volume: 1,
  };
}

function createContext() {
  const sessionStore = createSessionStore({
    initialProjectMetadata: { id: PROJECT_ID, name: 'Lifecycle', revision: 1 },
  });
  sessionStore.getState().addTrack(createTrack());
  const createSnapshotDocument = vi.fn(() =>
    createProjectDocumentV17FromSession({
      audioSources: [],
      pluginCatalog: [],
      session: sessionStore.getState(),
    })
  );
  const restoreSnapshotDocument = vi.fn<(document: ProjectDocumentSnapshot) => Promise<void>>(async () => undefined);
  const projectController = { createSnapshotDocument, restoreSnapshotDocument } as unknown as ProjectController;
  const ids = [CREATED_ID, APPLIED_TRACK_ID];
  const controller = new SessionLifecycleController({
    createId: () => ids.shift() ?? crypto.randomUUID(),
    now: () => new Date('2026-08-14T00:00:00.000Z'),
    projectController,
    sessionStore,
  });
  return { controller, restoreSnapshotDocument, sessionStore };
}

describe('SessionLifecycleController', () => {
  it('Named Snapshot을 현재 Session 문서로 저장하고 복원한다', async () => {
    const { controller, restoreSnapshotDocument, sessionStore } = createContext();

    const snapshotId = controller.createNamedSnapshot('Before mix');
    await controller.restoreNamedSnapshot(snapshotId);

    expect(snapshotId).toBe(CREATED_ID);
    expect(sessionStore.getState().lifecycle.snapshots[0]).toMatchObject({
      createdAt: '2026-08-14T00:00:00.000Z',
      id: CREATED_ID,
      name: 'Before mix',
    });
    expect(restoreSnapshotDocument).toHaveBeenCalledWith(sessionStore.getState().lifecycle.snapshots[0].document);
  });

  it('Track Template은 Source와 Region을 제외하고 새 Track ID로 현재 Session에 병합한다', async () => {
    const { controller, restoreSnapshotDocument } = createContext();

    const templateId = controller.createTemplate({ kind: 'track', name: 'Vocal strip', trackId: TRACK_ID });
    await controller.applyTemplate(templateId);

    const appliedDocument = restoreSnapshotDocument.mock.calls[0][0];
    expect(appliedDocument.tracks).toHaveLength(2);
    expect(appliedDocument.tracks[1]).toMatchObject({ id: APPLIED_TRACK_ID, name: 'Vocal', regions: [] });
    expect(appliedDocument.audioSources).toEqual([]);
  });
});
