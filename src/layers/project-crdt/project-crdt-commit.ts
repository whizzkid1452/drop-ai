import type { ProjectDocumentSnapshot } from '../shared/types/project-document.schema';
import { ProjectCrdtDocument } from './project-crdt-document';
import { decodeProjectCrdtUpdate, encodeProjectCrdtUpdate } from './project-crdt-update-codec';

interface CreateProjectCrdtCommitRequest {
  readonly previousDocument: ProjectDocumentSnapshot | null;
  readonly previousStateBase64?: string;
  readonly nextDocument: ProjectDocumentSnapshot;
}

export interface ProjectCrdtCommit {
  readonly stateBase64: string;
  readonly updateBase64: string;
}

export function createProjectCrdtCommit({
  previousDocument,
  previousStateBase64,
  nextDocument,
}: CreateProjectCrdtCommitRequest): ProjectCrdtCommit {
  if (!previousDocument) {
    const initialDocument = ProjectCrdtDocument.create(nextDocument);
    try {
      const initialStateBase64 = encodeProjectCrdtUpdate(initialDocument.encodeStateAsUpdate());
      return { stateBase64: initialStateBase64, updateBase64: initialStateBase64 };
    } finally {
      initialDocument.destroy();
    }
  }

  const crdtDocument = previousStateBase64
    ? ProjectCrdtDocument.fromUpdate(decodeProjectCrdtUpdate(previousStateBase64))
    : ProjectCrdtDocument.create(previousDocument);
  try {
    const update = crdtDocument.applyProjectChange({
      baseDocument: previousDocument,
      nextDocument,
      origin: 'local-project-commit',
    });
    const stateBase64 = encodeProjectCrdtUpdate(crdtDocument.encodeStateAsUpdate());
    // 기존 JSON record에는 seed 이력이 없으므로 첫 전환 update에 전체 CRDT state를 담아야 서버에서 독립적으로 복원할 수 있다.
    const updateBase64 = previousStateBase64 ? encodeProjectCrdtUpdate(update) : stateBase64;
    return { stateBase64, updateBase64 };
  } finally {
    crdtDocument.destroy();
  }
}
