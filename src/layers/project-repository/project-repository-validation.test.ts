import { describe, expect, it } from 'vitest';
import { ProjectDocumentReadError, ProjectDocumentReadErrorCode } from '../shared/types/project-document-reader';
import { ProjectRepositoryErrorCode } from './errors';
import { throwStoredProjectDocumentReadError } from './project-repository-validation';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

describe('저장 ProjectDocument 판독 오류 변환', () => {
  it('판독기 오류가 아닌 예상 밖 오류는 그대로 다시 던진다', () => {
    const cause = new Error('unexpected reader failure');

    expect(() => throwStoredProjectDocumentReadError(cause, PROJECT_ID)).toThrow(cause);
  });

  it('지원하지 않는 schemaVersion을 저장소 호환성 오류로 변환한다', () => {
    const cause = new ProjectDocumentReadError({
      code: ProjectDocumentReadErrorCode.UNSUPPORTED_SCHEMA_VERSION,
      message: 'unsupported schema version',
      details: { schemaVersion: 3 },
    });

    expect(() => throwStoredProjectDocumentReadError(cause, PROJECT_ID)).toThrowError(
      expect.objectContaining({
        code: ProjectRepositoryErrorCode.UNSUPPORTED_STORED_DOCUMENT_SCHEMA_VERSION,
        details: { projectId: PROJECT_ID, schemaVersion: 3 },
        cause,
      })
    );
  });

  it('잘못된 현재 문서를 손상된 저장 데이터 오류로 변환한다', () => {
    const cause = new ProjectDocumentReadError({
      code: ProjectDocumentReadErrorCode.INVALID_DOCUMENT,
      message: 'invalid document',
    });

    expect(() => throwStoredProjectDocumentReadError(cause, PROJECT_ID)).toThrowError(
      expect.objectContaining({
        code: ProjectRepositoryErrorCode.INVALID_STORED_DATA,
        details: { projectId: PROJECT_ID },
        cause,
      })
    );
  });
});
