import { z } from 'zod';
import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V3,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V4,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V5,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V6,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V8,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V9,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V10,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V11,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V12,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V13,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V14,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V15,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V16,
  ProjectDocumentSchema,
  ProjectDocumentV2Schema,
  ProjectDocumentV3Schema,
  ProjectDocumentV4Schema,
  ProjectDocumentV5Schema,
  ProjectDocumentV6Schema,
  ProjectDocumentV7Schema,
  ProjectDocumentV8Schema,
  ProjectDocumentV9Schema,
  ProjectDocumentV10Schema,
  ProjectDocumentV11Schema,
  ProjectDocumentV12Schema,
  ProjectDocumentV13Schema,
  ProjectDocumentV14Schema,
  ProjectDocumentV15Schema,
  ProjectDocumentV16Schema,
  type ProjectDocument,
  type ProjectDocumentSnapshot,
  type ProjectDocumentV2,
  type ProjectDocumentV3,
  type ProjectDocumentV4,
  type ProjectDocumentV5,
  type ProjectDocumentV6,
  type ProjectDocumentV7,
  type ProjectDocumentV8,
  type ProjectDocumentV9,
  type ProjectDocumentV10,
  type ProjectDocumentV11,
  type ProjectDocumentV12,
  type ProjectDocumentV13,
  type ProjectDocumentV14,
  type ProjectDocumentV15,
  type ProjectDocumentV16,
  type ProjectAudioSource,
} from './project-document.schema';
import { createDefaultProjectRecordingState, createDefaultTrackRecordingState } from './multitrack-recording';
import { createDefaultRoutingGraphSnapshot } from './routing-state';

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
export const PROJECT_DOCUMENT_V3_MIGRATION_INPUT_VERSIONS = [
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V3,
] as const;
export const PROJECT_DOCUMENT_V4_MIGRATION_INPUT_VERSIONS = [
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V3,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V4,
] as const;
export const PROJECT_DOCUMENT_V5_MIGRATION_INPUT_VERSIONS = [
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V3,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V4,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V5,
] as const;
export const PROJECT_DOCUMENT_V6_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V5_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V6,
] as const;
export const PROJECT_DOCUMENT_V7_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V6_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
] as const;
export const PROJECT_DOCUMENT_V8_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V7_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V8,
] as const;
export const PROJECT_DOCUMENT_V9_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V8_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V9,
] as const;
export const PROJECT_DOCUMENT_V10_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V9_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V10,
] as const;
export const PROJECT_DOCUMENT_V11_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V10_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V11,
] as const;
export const PROJECT_DOCUMENT_V12_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V11_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V12,
] as const;
export const PROJECT_DOCUMENT_V13_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V12_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V13,
] as const;
export const PROJECT_DOCUMENT_V14_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V13_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V14,
] as const;
export const PROJECT_DOCUMENT_V15_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V14_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V15,
] as const;
export const PROJECT_DOCUMENT_V16_MIGRATION_INPUT_VERSIONS = [
  ...PROJECT_DOCUMENT_V15_MIGRATION_INPUT_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V16,
] as const;
export const PROJECT_DOCUMENT_SNAPSHOT_SCHEMA_VERSIONS = [
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V2,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V3,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V4,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V5,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V6,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V8,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V9,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V10,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V11,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V12,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V13,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V14,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V15,
  PROJECT_DOCUMENT_SCHEMA_VERSION_V16,
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

function parseProjectDocumentV3(input: unknown, schemaVersion: number): ProjectDocumentV3 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  let parseFailure: unknown;

  try {
    const documentResult = ProjectDocumentV3Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }

    parseFailure = documentResult.error;
  } catch (cause) {
    parseFailure = cause;
  }

  throw createInvalidDocumentError(schemaVersion, parseFailure);
}

function parseProjectDocumentV4(input: unknown, schemaVersion: number): ProjectDocumentV4 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  let parseFailure: unknown;

  try {
    const documentResult = ProjectDocumentV4Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    parseFailure = documentResult.error;
  } catch (cause) {
    parseFailure = cause;
  }

  throw createInvalidDocumentError(schemaVersion, parseFailure);
}

function parseProjectDocumentV5(input: unknown, schemaVersion: number): ProjectDocumentV5 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  let parseFailure: unknown;

  try {
    const documentResult = ProjectDocumentV5Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    parseFailure = documentResult.error;
  } catch (cause) {
    parseFailure = cause;
  }

  throw createInvalidDocumentError(schemaVersion, parseFailure);
}

function parseProjectDocumentV6(input: unknown, schemaVersion: number): ProjectDocumentV6 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  let parseFailure: unknown;

  try {
    const documentResult = ProjectDocumentV6Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    parseFailure = documentResult.error;
  } catch (cause) {
    parseFailure = cause;
  }

  throw createInvalidDocumentError(schemaVersion, parseFailure);
}

function parseProjectDocumentV7(input: unknown, schemaVersion: number): ProjectDocumentV7 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  let parseFailure: unknown;

  try {
    const documentResult = ProjectDocumentV7Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    parseFailure = documentResult.error;
  } catch (cause) {
    parseFailure = cause;
  }

  throw createInvalidDocumentError(schemaVersion, parseFailure);
}

function parseProjectDocumentV8(input: unknown, schemaVersion: number): ProjectDocumentV8 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  let parseFailure: unknown;

  try {
    const documentResult = ProjectDocumentV8Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    parseFailure = documentResult.error;
  } catch (cause) {
    parseFailure = cause;
  }

  throw createInvalidDocumentError(schemaVersion, parseFailure);
}

function parseProjectDocumentV9(input: unknown, schemaVersion: number): ProjectDocumentV9 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  let parseFailure: unknown;

  try {
    const documentResult = ProjectDocumentV9Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    parseFailure = documentResult.error;
  } catch (cause) {
    parseFailure = cause;
  }

  throw createInvalidDocumentError(schemaVersion, parseFailure);
}

function parseProjectDocumentV10(input: unknown, schemaVersion: number): ProjectDocumentV10 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  try {
    const documentResult = ProjectDocumentV10Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    throw documentResult.error;
  } catch (parseFailure) {
    throw createInvalidDocumentError(schemaVersion, parseFailure);
  }
}

function parseProjectDocumentV11(input: unknown, schemaVersion: number): ProjectDocumentV11 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  try {
    const documentResult = ProjectDocumentV11Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    throw documentResult.error;
  } catch (parseFailure) {
    throw createInvalidDocumentError(schemaVersion, parseFailure);
  }
}

function parseProjectDocumentV12(input: unknown, schemaVersion: number): ProjectDocumentV12 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  try {
    const documentResult = ProjectDocumentV12Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    throw documentResult.error;
  } catch (parseFailure) {
    throw createInvalidDocumentError(schemaVersion, parseFailure);
  }
}

function parseProjectDocumentV13(input: unknown, schemaVersion: number): ProjectDocumentV13 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  try {
    const documentResult = ProjectDocumentV13Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    throw documentResult.error;
  } catch (parseFailure) {
    throw createInvalidDocumentError(schemaVersion, parseFailure);
  }
}

function parseProjectDocumentV14(input: unknown, schemaVersion: number): ProjectDocumentV14 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  try {
    const documentResult = ProjectDocumentV14Schema.safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data;
    }
    throw documentResult.error;
  } catch (parseFailure) {
    throw createInvalidDocumentError(schemaVersion, parseFailure);
  }
}

function parseProjectDocumentV15(input: unknown, schemaVersion: number): ProjectDocumentV15 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  try {
    const documentResult = (ProjectDocumentV15Schema as z.ZodTypeAny).safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data as ProjectDocumentV15;
    }
    throw documentResult.error;
  } catch (parseFailure) {
    throw createInvalidDocumentError(schemaVersion, parseFailure);
  }
}

function parseProjectDocumentV16(input: unknown, schemaVersion: number): ProjectDocumentV16 {
  const clonedInput = cloneProjectDocumentInput(input, schemaVersion);
  try {
    const documentResult = (ProjectDocumentV16Schema as z.ZodTypeAny).safeParse(clonedInput);
    if (documentResult.success) {
      return documentResult.data as ProjectDocumentV16;
    }
    throw documentResult.error;
  } catch (parseFailure) {
    throw createInvalidDocumentError(schemaVersion, parseFailure);
  }
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

function migrateValidatedProjectDocumentV2ToV3(document: ProjectDocumentV2): ProjectDocumentV3 {
  return ProjectDocumentV3Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V3,
    tracks: document.tracks.map(track => ({
      ...track,
      loopSlots: [],
      pluginInstances: track.pluginInstances.map(instance => ({
        ...instance,
        parameters: instance.parameters.map(parameter => ({ ...parameter })),
      })),
      regions: track.regions.map(region => ({ ...region })),
    })),
    audioSources: document.audioSources.map(source => ({ ...source })),
    exportRange: document.exportRange ? { ...document.exportRange } : null,
    mixer: { ...document.mixer },
    project: { ...document.project },
    timeline: { ...document.timeline },
  });
}

function migrateValidatedProjectDocumentV3ToV4(document: ProjectDocumentV3): ProjectDocumentV4 {
  return ProjectDocumentV4Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V4,
    tracks: document.tracks.map(track => ({
      ...track,
      loopSlots: track.loopSlots.map(loopSlot => ({ ...loopSlot, overdubSourceIds: [] })),
      pluginInstances: track.pluginInstances.map(instance => ({
        ...instance,
        parameters: instance.parameters.map(parameter => ({ ...parameter })),
      })),
      regions: track.regions.map(region => ({ ...region })),
    })),
    audioSources: document.audioSources.map(source => ({ ...source })),
    exportRange: document.exportRange ? { ...document.exportRange } : null,
    mixer: { ...document.mixer },
    project: { ...document.project },
    timeline: { ...document.timeline },
  });
}

function migrateValidatedProjectDocumentV4ToV5(document: ProjectDocumentV4): ProjectDocumentV5 {
  // v4에는 위치별 정보가 없으므로 기존 Tempo와 4/4를 0 위치의 첫 marker로 보존합니다.
  return ProjectDocumentV5Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V5,
    timeline: {
      ...document.timeline,
      tempoChanges: [{ quarterNotePosition: 0, bpm: document.timeline.tempoBpm }],
      meterChanges: [{ quarterNotePosition: 0, beatsPerBar: 4, beatUnit: 4 }],
    },
    tracks: document.tracks.map(track => ({
      ...track,
      loopSlots: track.loopSlots.map(loopSlot => ({ ...loopSlot, overdubSourceIds: [...loopSlot.overdubSourceIds] })),
      pluginInstances: track.pluginInstances.map(instance => ({
        ...instance,
        parameters: instance.parameters.map(parameter => ({ ...parameter })),
      })),
      regions: track.regions.map(region => ({ ...region })),
    })),
    audioSources: document.audioSources.map(source => ({ ...source })),
    exportRange: document.exportRange ? { ...document.exportRange } : null,
    mixer: { ...document.mixer },
    project: { ...document.project },
  });
}

function migrateValidatedProjectDocumentV5ToV6(document: ProjectDocumentV5): ProjectDocumentV6 {
  return ProjectDocumentV6Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V6,
    timeline: {
      ...document.timeline,
      tempoChanges: document.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: document.timeline.meterChanges.map(change => ({ ...change })),
      // v5에는 Timeline Marker 필드가 없으므로 이전 시 빈 목록으로 초기화한다.
      markers: [],
    },
    tracks: document.tracks.map(track => ({
      ...track,
      loopSlots: track.loopSlots.map(loopSlot => ({ ...loopSlot, overdubSourceIds: [...loopSlot.overdubSourceIds] })),
      pluginInstances: track.pluginInstances.map(instance => ({
        ...instance,
        parameters: instance.parameters.map(parameter => ({ ...parameter })),
      })),
      regions: track.regions.map(region => ({ ...region })),
    })),
    audioSources: document.audioSources.map(source => ({ ...source })),
    exportRange: document.exportRange ? { ...document.exportRange } : null,
    mixer: { ...document.mixer },
    project: { ...document.project },
  });
}

function migrateValidatedProjectDocumentV6ToV7(document: ProjectDocumentV6): ProjectDocumentV7 {
  return ProjectDocumentV7Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V7,
    timeline: {
      ...document.timeline,
      loop: { isEnabled: false, range: null },
      metronome: { isEnabled: false, volume: 0.8 },
      markers: document.timeline.markers.map(marker => ({ ...marker })),
      tempoChanges: document.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: document.timeline.meterChanges.map(change => ({ ...change })),
    },
    tracks: document.tracks.map(track => ({
      ...track,
      loopSlots: track.loopSlots.map(loopSlot => ({ ...loopSlot, overdubSourceIds: [...loopSlot.overdubSourceIds] })),
      pluginInstances: track.pluginInstances.map(instance => ({
        ...instance,
        parameters: instance.parameters.map(parameter => ({ ...parameter })),
      })),
      regions: track.regions.map(region => ({ ...region })),
    })),
    audioSources: document.audioSources.map(source => ({ ...source })),
    exportRange: document.exportRange ? { ...document.exportRange } : null,
    mixer: { ...document.mixer },
    project: { ...document.project },
  });
}

function migrateValidatedProjectDocumentV7ToV8(document: ProjectDocumentV7): ProjectDocumentV8 {
  return ProjectDocumentV8Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V8,
    timeline: {
      ...document.timeline,
      loop: {
        isEnabled: document.timeline.loop.isEnabled,
        range: document.timeline.loop.range ? { ...document.timeline.loop.range } : null,
      },
      markers: document.timeline.markers.map(marker => ({ ...marker })),
      metronome: { ...document.timeline.metronome },
      tempoChanges: document.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: document.timeline.meterChanges.map(change => ({ ...change })),
    },
    tracks: document.tracks.map(track => ({
      ...track,
      loopSlots: track.loopSlots.map(loopSlot => ({ ...loopSlot, overdubSourceIds: [...loopSlot.overdubSourceIds] })),
      pluginInstances: track.pluginInstances.map(instance => ({
        ...instance,
        parameters: instance.parameters.map(parameter => ({ ...parameter })),
      })),
      regions: track.regions.map((region, layer) => ({
        ...region,
        fadeIn: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
        fadeOut: { crossfadeId: null, curve: 'linear', durationSeconds: 0 },
        gain: 1,
        isOpaque: false,
        layer,
      })),
    })),
    audioSources: document.audioSources.map(source => ({ ...source })),
    exportRange: document.exportRange ? { ...document.exportRange } : null,
    mixer: { ...document.mixer },
    project: { ...document.project },
  });
}

function migrateValidatedProjectDocumentV8ToV9(document: ProjectDocumentV8): ProjectDocumentV9 {
  return ProjectDocumentV9Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V9,
    timeline: {
      ...document.timeline,
      loop: {
        isEnabled: document.timeline.loop.isEnabled,
        range: document.timeline.loop.range ? { ...document.timeline.loop.range } : null,
      },
      markers: document.timeline.markers.map(marker => ({ ...marker })),
      metronome: { ...document.timeline.metronome },
      tempoChanges: document.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: document.timeline.meterChanges.map(change => ({ ...change })),
    },
    tracks: document.tracks.map(track => ({
      ...track,
      loopSlots: track.loopSlots.map(loopSlot => ({ ...loopSlot, overdubSourceIds: [...loopSlot.overdubSourceIds] })),
      pluginInstances: track.pluginInstances.map(instance => ({
        ...instance,
        parameters: instance.parameters.map(parameter => ({ ...parameter })),
      })),
      regions: track.regions.map(region => ({
        ...region,
        fadeIn: { ...region.fadeIn },
        fadeOut: { ...region.fadeOut },
      })),
    })),
    audioSources: document.audioSources.map(source => ({ ...source })),
    exportRange: document.exportRange ? { ...document.exportRange } : null,
    mixer: {
      masterVolume: document.mixer.masterVolume,
      routing: createDefaultRoutingGraphSnapshot(document.tracks.map(track => track.id)),
    },
    project: { ...document.project },
  });
}

function migrateValidatedProjectDocumentV9ToV10(document: ProjectDocumentV9): ProjectDocumentV10 {
  return ProjectDocumentV10Schema.parse({
    ...document,
    recording: createDefaultProjectRecordingState(),
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V10,
    timeline: {
      ...document.timeline,
      loop: {
        isEnabled: document.timeline.loop.isEnabled,
        range: document.timeline.loop.range ? { ...document.timeline.loop.range } : null,
      },
      markers: document.timeline.markers.map(marker => ({ ...marker })),
      metronome: { ...document.timeline.metronome },
      tempoChanges: document.timeline.tempoChanges.map(change => ({ ...change })),
      meterChanges: document.timeline.meterChanges.map(change => ({ ...change })),
    },
    tracks: document.tracks.map(track => ({
      ...track,
      loopSlots: track.loopSlots.map(loopSlot => ({ ...loopSlot, overdubSourceIds: [...loopSlot.overdubSourceIds] })),
      pluginInstances: track.pluginInstances.map(instance => ({
        ...instance,
        parameters: instance.parameters.map(parameter => ({ ...parameter })),
      })),
      recording: createDefaultTrackRecordingState(),
      regions: track.regions.map(region => ({
        ...region,
        fadeIn: { ...region.fadeIn },
        fadeOut: { ...region.fadeOut },
      })),
    })),
    audioSources: document.audioSources.map(source => ({ ...source })),
    exportRange: document.exportRange ? { ...document.exportRange } : null,
    mixer: {
      masterVolume: document.mixer.masterVolume,
      routing: {
        routes: document.mixer.routing.routes.map(route => ({
          ...route,
          output: { ...route.output },
          vcaIds: [...route.vcaIds],
        })),
        sends: document.mixer.routing.sends.map(send => ({ ...send })),
      },
    },
    project: { ...document.project },
  });
}

function migrateValidatedProjectDocumentV10ToV11(document: ProjectDocumentV10): ProjectDocumentV11 {
  return ProjectDocumentV11Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V11,
    tracks: document.tracks.map(track => ({ ...track, automationLanes: [] })),
  });
}

function migrateValidatedProjectDocumentV11ToV12(document: ProjectDocumentV11): ProjectDocumentV12 {
  return ProjectDocumentV12Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V12,
    tracks: document.tracks.map(track => ({
      ...track,
      automationLanes: track.automationLanes.map(lane => ({ ...lane, mode: 'read' })),
    })),
  });
}

function migrateValidatedProjectDocumentV12ToV13(document: ProjectDocumentV12): ProjectDocumentV13 {
  return ProjectDocumentV13Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V13,
    tracks: document.tracks.map(track => ({ ...track, midi: null })),
  });
}

function migrateValidatedProjectDocumentV13ToV14(document: ProjectDocumentV13): ProjectDocumentV14 {
  return ProjectDocumentV14Schema.parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V14,
    tracks: document.tracks.map(track => ({
      ...track,
      midi: track.midi
        ? {
            ...track.midi,
            recordMode: 'replace',
            regions: track.midi.regions.map(region => ({ ...region, controlLanes: [] })),
          }
        : null,
    })),
  });
}

function migrateValidatedProjectDocumentV14ToV15(document: ProjectDocumentV14): ProjectDocumentV15 {
  return (ProjectDocumentV15Schema as z.ZodTypeAny).parse({
    ...document,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V15,
    tracks: document.tracks.map(track => ({
      ...track,
      pluginInstances: track.pluginInstances.map(instance => ({
        ...instance,
        presetId: null,
        sidechainSourceTrackId: null,
        stateBlob: null,
      })),
    })),
  }) as ProjectDocumentV15;
}

function migrateValidatedProjectDocumentV15ToV16(document: ProjectDocumentV15): ProjectDocumentV16 {
  const schema = ProjectDocumentV16Schema as unknown as { parse(input: unknown): ProjectDocumentV16 };
  return schema.parse({
    ...document,
    audioSources: document.audioSources.map((source: ProjectAudioSource) => ({
      ...source,
      bwfMetadata: null,
      derivation: null,
      tags: [],
      transientPositionsSeconds: [],
    })),
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION_V16,
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

export function migrateProjectDocumentV2ToV3(document: ProjectDocumentV2): ProjectDocumentV3 {
  return migrateValidatedProjectDocumentV2ToV3(readProjectDocumentV2(document));
}

export function readProjectDocumentV3(input: unknown): ProjectDocumentV3 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION) {
    const v1Document = parseCurrentProjectDocument(input, schemaVersion);
    return migrateValidatedProjectDocumentV2ToV3(migrateValidatedProjectDocumentV1ToV2(v1Document));
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V2) {
    return migrateValidatedProjectDocumentV2ToV3(parseProjectDocumentV2(input, schemaVersion));
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V3) {
    return parseProjectDocumentV3(input, schemaVersion);
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V3_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV3ToV4(document: ProjectDocumentV3): ProjectDocumentV4 {
  return migrateValidatedProjectDocumentV3ToV4(readProjectDocumentV3(document));
}

export function readProjectDocumentV4(input: unknown): ProjectDocumentV4 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION) {
    const v1Document = parseCurrentProjectDocument(input, schemaVersion);
    return migrateValidatedProjectDocumentV3ToV4(
      migrateValidatedProjectDocumentV2ToV3(migrateValidatedProjectDocumentV1ToV2(v1Document))
    );
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V2) {
    return migrateValidatedProjectDocumentV3ToV4(
      migrateValidatedProjectDocumentV2ToV3(parseProjectDocumentV2(input, schemaVersion))
    );
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V3) {
    return migrateValidatedProjectDocumentV3ToV4(parseProjectDocumentV3(input, schemaVersion));
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V4) {
    return parseProjectDocumentV4(input, schemaVersion);
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V4_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV4ToV5(document: ProjectDocumentV4): ProjectDocumentV5 {
  return migrateValidatedProjectDocumentV4ToV5(readProjectDocumentV4(document));
}

export function readProjectDocumentV5(input: unknown): ProjectDocumentV5 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION) {
    const v1Document = parseCurrentProjectDocument(input, schemaVersion);
    return migrateValidatedProjectDocumentV4ToV5(
      migrateValidatedProjectDocumentV3ToV4(
        migrateValidatedProjectDocumentV2ToV3(migrateValidatedProjectDocumentV1ToV2(v1Document))
      )
    );
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V2) {
    return migrateValidatedProjectDocumentV4ToV5(
      migrateValidatedProjectDocumentV3ToV4(
        migrateValidatedProjectDocumentV2ToV3(parseProjectDocumentV2(input, schemaVersion))
      )
    );
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V3) {
    return migrateValidatedProjectDocumentV4ToV5(
      migrateValidatedProjectDocumentV3ToV4(parseProjectDocumentV3(input, schemaVersion))
    );
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V4) {
    return migrateValidatedProjectDocumentV4ToV5(parseProjectDocumentV4(input, schemaVersion));
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V5) {
    return parseProjectDocumentV5(input, schemaVersion);
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V5_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV5ToV6(document: ProjectDocumentV5): ProjectDocumentV6 {
  return migrateValidatedProjectDocumentV5ToV6(readProjectDocumentV5(document));
}

export function readProjectDocumentV6(input: unknown): ProjectDocumentV6 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V6) {
    return parseProjectDocumentV6(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V5_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV5ToV6(readProjectDocumentV5(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V6_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV6ToV7(document: ProjectDocumentV6): ProjectDocumentV7 {
  return migrateValidatedProjectDocumentV6ToV7(readProjectDocumentV6(document));
}

export function readProjectDocumentV7(input: unknown): ProjectDocumentV7 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V7) {
    return parseProjectDocumentV7(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V6_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV6ToV7(readProjectDocumentV6(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V7_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV7ToV8(document: ProjectDocumentV7): ProjectDocumentV8 {
  return migrateValidatedProjectDocumentV7ToV8(readProjectDocumentV7(document));
}

export function readProjectDocumentV8(input: unknown): ProjectDocumentV8 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V8) {
    return parseProjectDocumentV8(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V7_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV7ToV8(readProjectDocumentV7(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V8_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV8ToV9(document: ProjectDocumentV8): ProjectDocumentV9 {
  return migrateValidatedProjectDocumentV8ToV9(readProjectDocumentV8(document));
}

export function readProjectDocumentV9(input: unknown): ProjectDocumentV9 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V9) {
    return parseProjectDocumentV9(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V8_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV8ToV9(readProjectDocumentV8(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V9_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV9ToV10(document: ProjectDocumentV9): ProjectDocumentV10 {
  return migrateValidatedProjectDocumentV9ToV10(readProjectDocumentV9(document));
}

export function readProjectDocumentV10(input: unknown): ProjectDocumentV10 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V10) {
    return parseProjectDocumentV10(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V9_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV9ToV10(readProjectDocumentV9(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V10_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV10ToV11(document: ProjectDocumentV10): ProjectDocumentV11 {
  return migrateValidatedProjectDocumentV10ToV11(readProjectDocumentV10(document));
}

export function readProjectDocumentV11(input: unknown): ProjectDocumentV11 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V11) {
    return parseProjectDocumentV11(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V10_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV10ToV11(readProjectDocumentV10(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V11_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV11ToV12(document: ProjectDocumentV11): ProjectDocumentV12 {
  return migrateValidatedProjectDocumentV11ToV12(readProjectDocumentV11(document));
}

export function readProjectDocumentV12(input: unknown): ProjectDocumentV12 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V12) {
    return parseProjectDocumentV12(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V11_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV11ToV12(readProjectDocumentV11(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V12_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV12ToV13(document: ProjectDocumentV12): ProjectDocumentV13 {
  return migrateValidatedProjectDocumentV12ToV13(readProjectDocumentV12(document));
}

export function readProjectDocumentV13(input: unknown): ProjectDocumentV13 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V13) {
    return parseProjectDocumentV13(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V12_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV12ToV13(readProjectDocumentV12(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V13_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV13ToV14(document: ProjectDocumentV13): ProjectDocumentV14 {
  return migrateValidatedProjectDocumentV13ToV14(readProjectDocumentV13(document));
}

export function readProjectDocumentV14(input: unknown): ProjectDocumentV14 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V14) {
    return parseProjectDocumentV14(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V13_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV13ToV14(readProjectDocumentV13(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V14_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV14ToV15(document: ProjectDocumentV14): ProjectDocumentV15 {
  return migrateValidatedProjectDocumentV14ToV15(readProjectDocumentV14(document));
}

export function readProjectDocumentV15(input: unknown): ProjectDocumentV15 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V15) {
    return parseProjectDocumentV15(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V14_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV14ToV15(readProjectDocumentV14(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V15_MIGRATION_INPUT_VERSIONS,
  });
}

export function migrateProjectDocumentV15ToV16(document: ProjectDocumentV15): ProjectDocumentV16 {
  return migrateValidatedProjectDocumentV15ToV16(readProjectDocumentV15(document));
}

export function readProjectDocumentV16(input: unknown): ProjectDocumentV16 {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V16) {
    return parseProjectDocumentV16(input, schemaVersion);
  }
  if (PROJECT_DOCUMENT_V15_MIGRATION_INPUT_VERSIONS.some(version => version === schemaVersion)) {
    return migrateValidatedProjectDocumentV15ToV16(readProjectDocumentV15(input));
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_V16_MIGRATION_INPUT_VERSIONS,
  });
}

export function readProjectDocumentSnapshot(input: unknown): ProjectDocumentSnapshot {
  const schemaVersion = readProjectDocumentSchemaVersion(input);
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION) {
    return parseCurrentProjectDocument(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V2) {
    return parseProjectDocumentV2(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V3) {
    return parseProjectDocumentV3(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V4) {
    return parseProjectDocumentV4(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V5) {
    return parseProjectDocumentV5(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V6) {
    return parseProjectDocumentV6(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V7) {
    return parseProjectDocumentV7(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V8) {
    return parseProjectDocumentV8(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V9) {
    return parseProjectDocumentV9(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V10) {
    return parseProjectDocumentV10(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V11) {
    return parseProjectDocumentV11(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V12) {
    return parseProjectDocumentV12(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V13) {
    return parseProjectDocumentV13(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V14) {
    return parseProjectDocumentV14(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V15) {
    return parseProjectDocumentV15(input, schemaVersion);
  }
  if (schemaVersion === PROJECT_DOCUMENT_SCHEMA_VERSION_V16) {
    return parseProjectDocumentV16(input, schemaVersion);
  }

  throw createUnsupportedSchemaVersionError({
    schemaVersion,
    supportedSchemaVersions: PROJECT_DOCUMENT_SNAPSHOT_SCHEMA_VERSIONS,
  });
}

export function readProjectDocumentJson(json: string): ProjectDocument {
  return readProjectDocument(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV2(json: string): ProjectDocumentV2 {
  return readProjectDocumentV2(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV3(json: string): ProjectDocumentV3 {
  return readProjectDocumentV3(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV4(json: string): ProjectDocumentV4 {
  return readProjectDocumentV4(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV5(json: string): ProjectDocumentV5 {
  return readProjectDocumentV5(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV6(json: string): ProjectDocumentV6 {
  return readProjectDocumentV6(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV7(json: string): ProjectDocumentV7 {
  return readProjectDocumentV7(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV8(json: string): ProjectDocumentV8 {
  return readProjectDocumentV8(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV9(json: string): ProjectDocumentV9 {
  return readProjectDocumentV9(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV10(json: string): ProjectDocumentV10 {
  return readProjectDocumentV10(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV11(json: string): ProjectDocumentV11 {
  return readProjectDocumentV11(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV12(json: string): ProjectDocumentV12 {
  return readProjectDocumentV12(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV13(json: string): ProjectDocumentV13 {
  return readProjectDocumentV13(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV14(json: string): ProjectDocumentV14 {
  return readProjectDocumentV14(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV15(json: string): ProjectDocumentV15 {
  return readProjectDocumentV15(parseProjectDocumentJsonInput(json));
}

export function readProjectDocumentJsonV16(json: string): ProjectDocumentV16 {
  return readProjectDocumentV16(parseProjectDocumentJsonInput(json));
}
