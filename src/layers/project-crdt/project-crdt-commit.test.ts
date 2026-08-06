import { describe, expect, it } from 'vitest';
import type { ProjectDocument } from '../shared/types/project-document.schema';
import { createProjectCrdtCommit } from './project-crdt-commit';
import { ProjectCrdtDocument } from './project-crdt-document';
import { decodeProjectCrdtUpdate } from './project-crdt-update-codec';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function createProjectDocument(name: string, revision: number): ProjectDocument {
  return {
    documentType: 'drop-ai-project',
    schemaVersion: 1,
    project: { id: PROJECT_ID, name, revision },
    timeline: { timeUnit: 'seconds', tempoBpm: 120 },
    mixer: { masterVolume: 1 },
    exportRange: null,
    audioSources: [],
    tracks: [],
  };
}

describe('createProjectCrdtCommit', () => {
  it('첫 로컬 문서를 독립적으로 복원 가능한 CRDT update로 만든다', () => {
    const document = createProjectDocument('첫 문서', 0);

    const commit = createProjectCrdtCommit({ previousDocument: null, nextDocument: document });
    const restored = ProjectCrdtDocument.fromUpdate(decodeProjectCrdtUpdate(commit.updateBase64));

    expect(restored.toProjectDocument()).toEqual(document);
    restored.destroy();
  });

  it('저장한 CRDT state를 이어 다음 변경분 update를 만든다', () => {
    const firstDocument = createProjectDocument('첫 문서', 0);
    const firstCommit = createProjectCrdtCommit({ previousDocument: null, nextDocument: firstDocument });
    const nextDocument = createProjectDocument('수정 문서', 1);
    const nextCommit = createProjectCrdtCommit({
      previousDocument: firstDocument,
      previousStateBase64: firstCommit.stateBase64,
      nextDocument,
    });
    const remote = ProjectCrdtDocument.fromUpdate(decodeProjectCrdtUpdate(firstCommit.updateBase64));

    remote.applyUpdate(decodeProjectCrdtUpdate(nextCommit.updateBase64));

    expect(remote.toProjectDocument()).toEqual(nextDocument);
    remote.destroy();
  });

  it('기존 JSON 문서의 첫 CRDT 전환 update에 seed와 변경을 함께 포함한다', () => {
    const previousDocument = createProjectDocument('기존 문서', 0);
    const nextDocument = createProjectDocument('전환 문서', 1);

    const commit = createProjectCrdtCommit({ previousDocument, nextDocument });
    const restored = ProjectCrdtDocument.fromUpdate(decodeProjectCrdtUpdate(commit.updateBase64));

    expect(restored.toProjectDocument()).toEqual(nextDocument);
    restored.destroy();
  });
});
