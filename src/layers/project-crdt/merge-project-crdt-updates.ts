import type { ProjectDocumentSnapshot } from '../shared/types/project-document.schema';
import { ProjectCrdtDocument } from './project-crdt-document';
import { decodeProjectCrdtUpdate, encodeProjectCrdtUpdate } from './project-crdt-update-codec';

interface MergeProjectCrdtUpdatesRequest {
  readonly currentStateBase64?: string;
  readonly updateBase64Values: readonly string[];
}

export interface MergedProjectCrdtState {
  readonly document: ProjectDocumentSnapshot;
  readonly stateBase64: string;
}

export function mergeProjectCrdtUpdates({
  currentStateBase64,
  updateBase64Values,
}: MergeProjectCrdtUpdatesRequest): MergedProjectCrdtState {
  const [firstUpdateBase64, ...remainingUpdateBase64Values] = updateBase64Values;
  if (!firstUpdateBase64) {
    throw new Error('병합할 CRDT update가 없습니다.');
  }

  // 로컬 상태가 없을 때 JSON으로 새 문서를 만들면 서버와 다른 Yjs 식별자가 생기므로 첫 원격 update를 초기 상태로 사용한다.
  const crdtDocument = currentStateBase64
    ? ProjectCrdtDocument.fromUpdate(decodeProjectCrdtUpdate(currentStateBase64))
    : ProjectCrdtDocument.fromUpdate(decodeProjectCrdtUpdate(firstUpdateBase64));
  try {
    const updatesToApply = currentStateBase64 ? updateBase64Values : remainingUpdateBase64Values;
    updatesToApply.forEach(updateBase64 => {
      crdtDocument.applyUpdate(decodeProjectCrdtUpdate(updateBase64), 'remote-project-sync');
    });
    return {
      document: crdtDocument.toProjectDocument(),
      stateBase64: encodeProjectCrdtUpdate(crdtDocument.encodeStateAsUpdate()),
    };
  } finally {
    crdtDocument.destroy();
  }
}
