import { describe, expect, it } from 'vitest';
import { readProjectDocumentV5, readProjectDocumentV9 } from '../shared/types/project-document-reader';
import type {
  ProjectDocument,
  ProjectDocumentSnapshot,
  ProjectDocumentV5,
  ProjectTrack,
} from '../shared/types/project-document.schema';
import { ProjectCrdtDocument } from './project-crdt-document';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const FIRST_TRACK_ID = '22222222-2222-4222-8222-222222222222';
const SECOND_TRACK_ID = '33333333-3333-4333-8333-333333333333';
const THIRD_TRACK_ID = '44444444-4444-4444-8444-444444444444';

function createTrack(id: string, name: string): ProjectTrack {
  return {
    id,
    name,
    volume: 1,
    pan: 0,
    isMuted: false,
    isSoloed: false,
    regions: [],
  };
}

function createProjectDocument(): ProjectDocument {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: 1,
    project: { id: PROJECT_ID, name: '공동 프로젝트', revision: 0 },
    timeline: { timeUnit: 'seconds', tempoBpm: 120 },
    mixer: { masterVolume: 1 },
    exportRange: null,
    audioSources: [],
    tracks: [createTrack(FIRST_TRACK_ID, '첫 트랙')],
  };
}

function createProjectDocumentV5(): ProjectDocumentV5 {
  const document = readProjectDocumentV5(createProjectDocument());
  return {
    ...document,
    timeline: {
      ...document.timeline,
      tempoChanges: [
        { quarterNotePosition: 0, bpm: 120 },
        { quarterNotePosition: 4, bpm: 90 },
      ],
      meterChanges: [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }],
    },
  };
}

function cloneDocument(document: ProjectDocument): ProjectDocument {
  return structuredClone(document);
}

function createPeers(baseDocument: ProjectDocument): [ProjectCrdtDocument, ProjectCrdtDocument] {
  const seed = ProjectCrdtDocument.create(baseDocument).encodeStateAsUpdate();
  return [ProjectCrdtDocument.fromUpdate(seed), ProjectCrdtDocument.fromUpdate(seed)];
}

function createSnapshotPeers(baseDocument: ProjectDocumentSnapshot): [ProjectCrdtDocument, ProjectCrdtDocument] {
  const seed = ProjectCrdtDocument.create(baseDocument).encodeStateAsUpdate();
  return [ProjectCrdtDocument.fromUpdate(seed), ProjectCrdtDocument.fromUpdate(seed)];
}

describe('ProjectCrdtDocument', () => {
  it('v9 Route를 Track ID keyed collection으로 보존한다', () => {
    const baseDocument = readProjectDocumentV9(createProjectDocument());
    const firstPeer = ProjectCrdtDocument.create(baseDocument);
    const secondPeer = ProjectCrdtDocument.fromUpdate(firstPeer.encodeStateAsUpdate());
    const nextDocument = structuredClone(baseDocument);
    nextDocument.mixer.routing.routes[0].channelCount = 1;
    nextDocument.project.revision = 1;

    const update = firstPeer.applyProjectChange({ baseDocument, nextDocument });
    secondPeer.applyUpdate(update);

    expect(secondPeer.toProjectDocument()).toMatchObject({
      mixer: { routing: { routes: [{ channelCount: 1, trackId: FIRST_TRACK_ID }] } },
    });
  });

  it('Tempo marker의 BPM을 수정해도 음악 위치 순서를 유지한다', () => {
    const baseDocument = createProjectDocumentV5();
    const [firstPeer, secondPeer] = createSnapshotPeers(baseDocument);
    const nextDocument = structuredClone(baseDocument);
    nextDocument.timeline.tempoChanges[1].bpm = 100;
    nextDocument.project.revision = 1;

    const update = firstPeer.applyProjectChange({ baseDocument, nextDocument });
    secondPeer.applyUpdate(update);

    expect(secondPeer.toProjectDocument().timeline).toMatchObject({
      tempoChanges: [
        { quarterNotePosition: 0, bpm: 120 },
        { quarterNotePosition: 4, bpm: 100 },
      ],
    });
  });

  it('서로 다른 필드의 동시 변경을 적용 순서와 무관하게 모두 보존한다', () => {
    const baseDocument = createProjectDocument();
    const [firstPeer, secondPeer] = createPeers(baseDocument);
    const firstDocument = cloneDocument(baseDocument);
    firstDocument.timeline.tempoBpm = 132;
    firstDocument.project.revision = 1;
    const secondDocument = cloneDocument(baseDocument);
    secondDocument.tracks[0].name = '보컬';
    secondDocument.project.revision = 1;

    const firstUpdate = firstPeer.applyProjectChange({ baseDocument, nextDocument: firstDocument });
    const secondUpdate = secondPeer.applyProjectChange({ baseDocument, nextDocument: secondDocument });
    firstPeer.applyUpdate(secondUpdate);
    secondPeer.applyUpdate(firstUpdate);

    expect(firstPeer.toProjectDocument()).toEqual(secondPeer.toProjectDocument());
    expect(firstPeer.toProjectDocument()).toMatchObject({
      timeline: { tempoBpm: 132 },
      tracks: [{ id: FIRST_TRACK_ID, name: '보컬' }],
    });
  });

  it('서로 다른 Track의 동시 추가를 모두 보존한다', () => {
    const baseDocument = createProjectDocument();
    const [firstPeer, secondPeer] = createPeers(baseDocument);
    const firstDocument = cloneDocument(baseDocument);
    firstDocument.tracks.push(createTrack(SECOND_TRACK_ID, '기타'));
    firstDocument.project.revision = 1;
    const secondDocument = cloneDocument(baseDocument);
    secondDocument.tracks.push(createTrack(THIRD_TRACK_ID, '드럼'));
    secondDocument.project.revision = 1;

    const firstUpdate = firstPeer.applyProjectChange({ baseDocument, nextDocument: firstDocument });
    const secondUpdate = secondPeer.applyProjectChange({ baseDocument, nextDocument: secondDocument });
    secondPeer.applyUpdate(firstUpdate);
    firstPeer.applyUpdate(secondUpdate);

    const firstResult = firstPeer.toProjectDocument();
    expect(firstResult).toEqual(secondPeer.toProjectDocument());
    expect(firstResult.tracks.map(track => track.id)).toEqual(
      expect.arrayContaining([FIRST_TRACK_ID, SECOND_TRACK_ID, THIRD_TRACK_ID])
    );
  });

  it('같은 Track에서도 서로 다른 속성의 동시 변경을 모두 보존한다', () => {
    const baseDocument = createProjectDocument();
    const [firstPeer, secondPeer] = createPeers(baseDocument);
    const firstDocument = cloneDocument(baseDocument);
    firstDocument.tracks[0].name = '리드 보컬';
    firstDocument.project.revision = 1;
    const secondDocument = cloneDocument(baseDocument);
    secondDocument.tracks[0].volume = 0.4;
    secondDocument.project.revision = 1;

    const firstUpdate = firstPeer.applyProjectChange({ baseDocument, nextDocument: firstDocument });
    const secondUpdate = secondPeer.applyProjectChange({ baseDocument, nextDocument: secondDocument });
    firstPeer.applyUpdate(secondUpdate);
    secondPeer.applyUpdate(firstUpdate);

    expect(firstPeer.toProjectDocument()).toEqual(secondPeer.toProjectDocument());
    expect(firstPeer.toProjectDocument().tracks[0]).toMatchObject({ name: '리드 보컬', volume: 0.4 });
  });

  it('같은 update를 반복 적용해도 상태가 바뀌지 않는다', () => {
    const baseDocument = createProjectDocument();
    const [firstPeer, secondPeer] = createPeers(baseDocument);
    const nextDocument = cloneDocument(baseDocument);
    nextDocument.mixer.masterVolume = 0.5;
    nextDocument.project.revision = 1;
    const update = firstPeer.applyProjectChange({ baseDocument, nextDocument });

    secondPeer.applyUpdate(update);
    const firstResult = secondPeer.toProjectDocument();
    secondPeer.applyUpdate(update);

    expect(secondPeer.toProjectDocument()).toEqual(firstResult);
  });

  it('같은 scalar 필드의 동시 변경도 모든 peer에서 같은 값으로 수렴한다', () => {
    const baseDocument = createProjectDocument();
    const [firstPeer, secondPeer] = createPeers(baseDocument);
    const firstDocument = cloneDocument(baseDocument);
    firstDocument.timeline.tempoBpm = 130;
    firstDocument.project.revision = 1;
    const secondDocument = cloneDocument(baseDocument);
    secondDocument.timeline.tempoBpm = 140;
    secondDocument.project.revision = 1;

    const firstUpdate = firstPeer.applyProjectChange({ baseDocument, nextDocument: firstDocument });
    const secondUpdate = secondPeer.applyProjectChange({ baseDocument, nextDocument: secondDocument });
    firstPeer.applyUpdate(secondUpdate);
    secondPeer.applyUpdate(firstUpdate);

    expect(firstPeer.toProjectDocument()).toEqual(secondPeer.toProjectDocument());
    expect([130, 140]).toContain(firstPeer.toProjectDocument().timeline.tempoBpm);
  });

  it('keyed collection의 순서 변경을 update로 보존한다', () => {
    const baseDocument = createProjectDocument();
    baseDocument.tracks.push(createTrack(SECOND_TRACK_ID, '기타'), createTrack(THIRD_TRACK_ID, '드럼'));
    const [firstPeer, secondPeer] = createPeers(baseDocument);
    const nextDocument = cloneDocument(baseDocument);
    nextDocument.tracks = [nextDocument.tracks[2], nextDocument.tracks[0], nextDocument.tracks[1]];
    nextDocument.project.revision = 1;

    const update = firstPeer.applyProjectChange({ baseDocument, nextDocument });
    secondPeer.applyUpdate(update);

    expect(secondPeer.toProjectDocument().tracks.map(track => track.id)).toEqual([
      THIRD_TRACK_ID,
      FIRST_TRACK_ID,
      SECOND_TRACK_ID,
    ]);
  });

  it('동시에 바꾼 keyed collection 순서도 모든 peer에서 같은 결과로 수렴한다', () => {
    const baseDocument = createProjectDocument();
    baseDocument.tracks.push(createTrack(SECOND_TRACK_ID, '기타'), createTrack(THIRD_TRACK_ID, '드럼'));
    const [firstPeer, secondPeer] = createPeers(baseDocument);
    const firstDocument = cloneDocument(baseDocument);
    firstDocument.tracks.reverse();
    firstDocument.project.revision = 1;
    const secondDocument = cloneDocument(baseDocument);
    secondDocument.tracks = [secondDocument.tracks[1], secondDocument.tracks[2], secondDocument.tracks[0]];
    secondDocument.project.revision = 1;

    const firstUpdate = firstPeer.applyProjectChange({ baseDocument, nextDocument: firstDocument });
    const secondUpdate = secondPeer.applyProjectChange({ baseDocument, nextDocument: secondDocument });
    firstPeer.applyUpdate(secondUpdate);
    secondPeer.applyUpdate(firstUpdate);

    const firstOrder = firstPeer.toProjectDocument().tracks.map(track => track.id);
    expect(firstOrder).toEqual(secondPeer.toProjectDocument().tracks.map(track => track.id));
    expect(firstOrder).toEqual(expect.arrayContaining([FIRST_TRACK_ID, SECOND_TRACK_ID, THIRD_TRACK_ID]));
  });
});
