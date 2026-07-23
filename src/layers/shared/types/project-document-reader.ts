import { z } from 'zod';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
  ProjectDocumentSchema,
  ProjectDocumentV2Schema,
  type ProjectDocument,
  type ProjectDocumentV2,
} from './project-document.schema';

export const ProjectDocumentReadErrorCode = {
  INVALID_DOCUMENT: 'INVALID_DOCUMENT',
  INVALID_DOCUMENT_HEADER: 'INVALID_DOCUMENT_HEADER',
  INVALID_JSON: 'INVALID_JSON',
  INVALID_SCHEMA_VERSION: 'INVALID_SCHEMA_VERSION',
  UNSUPPORTED_DOCUMENT_TYPE: 'UNSUPPORTED_DOCUMENT_TYPE',
  UNSUPPORTED_SCHEMA_VERSION: 'UNSUPPORTED_SCHEMA_VERSION',
} as const;

export type ProjectDocumentReadErrorCode =
  (typeof ProjectDocumentReadErrorCode)[keyof typeof ProjectDocumentReadErrorCode];

export const SUPPORTED_PROJECT_DOCUMENT_SCHEMA_VERSIONS = [PROJECT_DOCUMENT_SCHEMA_VERSION] as const;
export const PROJECT_DOCUMENT_V2_MIGRATION_INPUT_VERSIONS = [
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
] as const;

const ProjectDocumentSchemaVersionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const ARRAY_INDEX_PATTERN = /^(?:0|[1-9]\d*)$/;
const MAX_ARRAY_LENGTH = 2 ** 32 - 1;

interface OwnDataPropertyReadOptions {
  readonly input: object;
  readonly propertyName: string;
  readonly errorCode: ProjectDocumentReadErrorCode;
  readonly errorMessage: string;
}

type OwnDataPropertyReadResult = { readonly exists: false } | { readonly exists: true; readonly value: unknown };

interface ProjectDocumentReadErrorOptions {
  readonly code: ProjectDocumentReadErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

export class ProjectDocumentReadError extends Error {
  readonly code: ProjectDocumentReadErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor({ code, message, details, cause }: ProjectDocumentReadErrorOptions) {
    super(message, { cause });
    this.name = 'ProjectDocumentReadError';
    this.code = code;
    this.details = details;
  }
}

function readTopLevelObject(input: unknown): object {
  try {
    if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
      return input;
    }
  } catch (cause) {
    throw new ProjectDocumentReadError({
      code: ProjectDocumentReadErrorCode.INVALID_DOCUMENT_HEADER,
      message: '프로젝트 문서의 최상위 객체와 documentType이 필요합니다.',
      cause,
    });
  }

  throw new ProjectDocumentReadError({
    code: ProjectDocumentReadErrorCode.INVALID_DOCUMENT_HEADER,
    message: '프로젝트 문서의 최상위 객체와 documentType이 필요합니다.',
  });
}

function readOwnDataProperty({
  input,
  propertyName,
  errorCode,
  errorMessage,
}: OwnDataPropertyReadOptions): OwnDataPropertyReadResult {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(input, propertyName);
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      return { exists: false };
    }

    return { exists: true, value: descriptor.value };
  } catch (cause) {
    throw new ProjectDocumentReadError({
      code: errorCode,
      message: errorMessage,
      cause,
    });
  }
}

function createInvalidDocumentError(schemaVersion: number, cause: unknown): ProjectDocumentReadError {
  return new ProjectDocumentReadError({
    code: ProjectDocumentReadErrorCode.INVALID_DOCUMENT,
    message: `ProjectDocument v${schemaVersion} 본문이 유효하지 않습니다.`,
    details: { schemaVersion },
    cause,
  });
}

function isArrayIndexProperty(propertyName: string): boolean {
  if (!ARRAY_INDEX_PATTERN.test(propertyName)) {
    return false;
  }

  const index = Number(propertyName);
  return Number.isSafeInteger(index) && index < MAX_ARRAY_LENGTH;
}

function cloneOwnDataValue(input: unknown, ancestors: WeakSet<object>): unknown {
  if (input === null || typeof input !== 'object') {
    return input;
  }

  if (ancestors.has(input)) {
    throw new TypeError('ProjectDocument cannot contain cyclic references');
  }

  ancestors.add(input);
  try {
    const isArray = Array.isArray(input);
    const clone: object = isArray ? [] : Object.create(null);
    let ownArrayIndexCount = 0;

    Reflect.ownKeys(input).forEach(propertyName => {
      const descriptor = Object.getOwnPropertyDescriptor(input, propertyName);
      if (!descriptor) {
        throw new TypeError('ProjectDocument property descriptor is unavailable');
      }

      if (!descriptor.enumerable) {
        return;
      }

      if (typeof propertyName !== 'string' || !('value' in descriptor)) {
        throw new TypeError('ProjectDocument must contain only own data properties');
      }

      if (isArray && !isArrayIndexProperty(propertyName)) {
        throw new TypeError('ProjectDocument arrays cannot contain named properties');
      }

      if (isArray) {
        ownArrayIndexCount += 1;
      }

      Object.defineProperty(clone, propertyName, {
        configurable: true,
        enumerable: true,
        value: cloneOwnDataValue(descriptor.value, ancestors),
        writable: true,
      });
    });

    if (isArray) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(input, 'length');
      if (!lengthDescriptor || !('value' in lengthDescriptor) || typeof lengthDescriptor.value !== 'number') {
        throw new TypeError('ProjectDocument array length is invalid');
      }

      if (ownArrayIndexCount !== lengthDescriptor.value) {
        throw new TypeError('ProjectDocument arrays cannot contain empty items');
      }

      (clone as unknown[]).length = lengthDescriptor.value;
    }

    return clone;
  } finally {
    ancestors.delete(input);
  }
}

function cloneProjectDocumentInput(input: unknown, schemaVersion: number): unknown {
  try {
    return cloneOwnDataValue(input, new WeakSet<object>());
  } catch (cause) {
    throw createInvalidDocumentError(schemaVersion, cause);
  }
}

function parseCurrentProjectDocument(input: unknown, schemaVersion: number): ProjectDocument {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  let parseFailure: unknown;

  try {
    const documentResult = ProjectDocumentSchema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }

    parseFailure = documentResult.error;
  } catch (cause) {
    parseFailure = cause;
  }

  throw createInvalidDocumentError(schemaVersion, parseFailure);
}

function parseProjectDocumentV2(input: unknown, schemaVersion: number): ProjectDocumentV2 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  let parseFailure: unknown;

  try {
    const documentResult = ProjectDocumentV2Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }

    parseFailure = documentResult.error;
  } catch (cause) {
    parseFailure = cause;
  }

  throw createInvalidDocumentError(schemaVersion, parseFailure);
}

function readProjectDocumentSchemaVersion(input: unknown): number {
  const topLevelObject = readTopLevelObject(input);
  const documentTypeProperty = readOwnDataProperty({
    input: topLevelObject,
    propertyName: 'documentType',
    errorCode: ProjectDocumentReadErrorCode.INVALID_DOCUMENT_HEADER,
    errorMessage: '프로젝트 문서의 documentType을 읽을 수 없습니다.',
  });
  if (!documentTypeProperty.exists || typeof documentTypeProperty.value !== 'string') {
    throw new ProjectDocumentReadError({
      code: ProjectDocumentReadErrorCode.INVALID_DOCUMENT_HEADER,
      message: '프로젝트 문서의 최상위 객체와 documentType이 필요합니다.',
    });
  }

  if (documentTypeProperty.value !== 'drop-ai-project') {
    throw new ProjectDocumentReadError({
      code: ProjectDocumentReadErrorCode.UNSUPPORTED_DOCUMENT_TYPE,
      message: '지원하지 않는 프로젝트 문서 종류입니다.',
      details: { expectedDocumentType: 'drop-ai-project' },
    });
  }

  const schemaVersionProperty = readOwnDataProperty({
    input: topLevelObject,
    propertyName: 'schemaVersion',
    errorCode: ProjectDocumentReadErrorCode.INVALID_SCHEMA_VERSION,
    errorMessage: '프로젝트 문서의 schemaVersion을 읽을 수 없습니다.',
  });
  const schemaVersionResult = ProjectDocumentSchemaVersionSchema.safeParse(
    schemaVersionProperty.exists ? schemaVersionProperty.value : undefined
  );
  if (!schemaVersionResult.success) {
    throw new ProjectDocumentReadError({
      code: ProjectDocumentReadErrorCode.INVALID_SCHEMA_VERSION,
      message: 'schemaVersion은 1 이상의 안전 정수여야 합니다.',
      cause: schemaVersionResult.error,
    });
  }

  return schemaVersionResult.data;
}

function createUnsupportedSchemaVersionError({
  schemaVersion,
  supportedSchemaVersions,
}: {
  readonly schemaVersion: number;
  readonly supportedSchemaVersions: readonly number[];
}): ProjectDocumentReadError {
  return new ProjectDocumentReadError({
    code: ProjectDocumentReadErrorCode.UNSUPPORTED_SCHEMA_VERSION,
    message: `지원하지 않는 프로젝트 문서 버전입니다: ${schemaVersion}`,
    details: {
      schemaVersion,
      supportedSchemaVersions,
    },
  });
}

function migrateValidatedProjectDocumentV1ToV2(document: ProjectDocument): ProjectDocumentV2 {
  return ProjectDocumentV2Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
    tracks: document.tracks.map(track => ({
      ...track,
      pluginInstances: [],
      regions: track.regions.map(region => ({ ...region })),
    })),
    audioSources: document.audioSources.map(source => ({ ...source })),
    exportRange: document.exportRange ? { ...document.exportRange } : null,
    mixer: { ...document.mixer },
    project: { ...document.project },
    timeline: { ...document.timeline },
  });
}

function parseProjectDocumentJsonInput(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch (cause) {
    throw new ProjectDocumentReadError({
      code: ProjectDocumentReadErrorCode.INVALID_JSON,
      message: '프로젝트 JSON 문법이 유효하지 않습니다.',
      cause,
    });
  }
}

export function readProjectDocument(input: unknown): ProjectDocument {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion !== PROJECT_DOCUMENT_SCHEMA_VERSION) {
    throw createUnsupportedSchemaVersionError({
      schemaVersion,
      supportedSchemaVersions: SUPPORTED_PROJECT_DOCUMENT_SCHEMA_VERSIONS,
    });
  }

  return parseCurrentProjectDocument(input, schemaVersion);
}

export function migrateProjectDocumentV1ToV2(document: ProjectDocument): ProjectDocumentV2 {
  return migrateValidatedProjectDocumentV1ToV2(readProjectDocument(document));
}

export function readProjectDocumentV2(input: unknown): ProjectDocumentV2 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION) {
    return migrateValidatedProjectDocumentV1ToV2(parseCurrentProjectDocument(input, schemaVersion));
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V2) {
    return parseProjectDocumentV2(input, schemaVersion);
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V2_MIGRATION_INPUT_VERSIONS,
  });
}

export function readProjectDocumentJson(json: string): ProjectDocument {
  return readProjectDocument(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV2(json: string): ProjectDocumentV2 {
  return readProjectDocumentV2(parseProjectDocumentJsonInput(json));
}
