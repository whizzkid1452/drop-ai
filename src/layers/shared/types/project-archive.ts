import { readProjectDocumentV18 } from './project-document-reader';
import type { ProjectAudioSourceV16, ProjectDocumentV18 } from './project-document.schema';

export const PROJECT_ARCHIVE_MIME_TYPE = 'application/vnd.drop-ai.session-archive+json';
const PROJECT_ARCHIVE_TYPE = 'drop-ai-session-archive';
const PROJECT_ARCHIVE_VERSION = 1;
const BASE64_CHUNK_SIZE = 32_768;

export interface ProjectArchiveSource {
  readonly blob: Blob;
  readonly metadata: ProjectAudioSourceV16;
}

export interface ProjectArchive {
  readonly document: ProjectDocumentV18;
  readonly sources: readonly ProjectArchiveSource[];
}

interface SerializedProjectArchive {
  readonly archiveType: typeof PROJECT_ARCHIVE_TYPE;
  readonly archiveVersion: typeof PROJECT_ARCHIVE_VERSION;
  readonly document: unknown;
  readonly sources: readonly {
    readonly dataBase64: string;
    readonly metadata: ProjectAudioSourceV16;
  }[];
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function readSerializedArchive(input: unknown): SerializedProjectArchive {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Archive 본문은 객체여야 합니다.');
  }
  const candidate = input as Partial<SerializedProjectArchive>;
  if (candidate.archiveType !== PROJECT_ARCHIVE_TYPE || candidate.archiveVersion !== PROJECT_ARCHIVE_VERSION) {
    throw new Error('지원하지 않는 Archive 형식입니다.');
  }
  if (!Array.isArray(candidate.sources)) {
    throw new Error('Archive Source 목록이 없습니다.');
  }
  return candidate as SerializedProjectArchive;
}

export async function createProjectArchiveBlob(archive: ProjectArchive): Promise<Blob> {
  const serialized: SerializedProjectArchive = {
    archiveType: PROJECT_ARCHIVE_TYPE,
    archiveVersion: PROJECT_ARCHIVE_VERSION,
    document: archive.document,
    sources: await Promise.all(
      archive.sources.map(async source => ({
        dataBase64: bytesToBase64(new Uint8Array(await source.blob.arrayBuffer())),
        metadata: source.metadata,
      }))
    ),
  };
  return new Blob([JSON.stringify(serialized)], { type: PROJECT_ARCHIVE_MIME_TYPE });
}

export async function readProjectArchiveBlob(blob: Blob): Promise<ProjectArchive> {
  const serialized = readSerializedArchive(JSON.parse(await blob.text()) as unknown);
  const document = readProjectDocumentV18(serialized.document);
  const metadataById = new Map(document.audioSources.map(metadata => [metadata.id, metadata]));
  const sources = serialized.sources.map(source => {
    const documentMetadata = metadataById.get(source.metadata.id);
    if (!documentMetadata || JSON.stringify(documentMetadata) !== JSON.stringify(source.metadata)) {
      throw new Error(`Archive Source metadata가 문서와 일치하지 않습니다: ${source.metadata.id}`);
    }
    const bytes = base64ToBytes(source.dataBase64);
    if (bytes.byteLength !== source.metadata.byteLength) {
      throw new Error(`Archive Source 크기가 metadata와 일치하지 않습니다: ${source.metadata.id}`);
    }
    return { blob: new Blob([bytes], { type: source.metadata.mimeType }), metadata: source.metadata };
  });
  if (sources.length !== document.audioSources.length) {
    throw new Error('Archive에 필요한 Source가 모두 포함되지 않았습니다.');
  }
  return { document, sources };
}
