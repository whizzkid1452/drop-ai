import { z } from 'zod';
import { ProjectAudioSourceSchema, type ProjectAudioSource } from '../shared/types/project-document.schema';
import { AudioSourceRepositoryError, AudioSourceRepositoryErrorCode } from './errors';
import type { CreateAudioSourceRequest, IAudioSourceRepository } from './i-audio-source-repository';

const OPFS_DIRECTORY_PATH = ['drop-ai', 'audio-sources', 'v1'] as const;
const SOURCE_OPERATION_LOCK_PREFIX = 'drop-ai:audio-source:v1:';
const SourceIdSchema = z.uuid('Invalid Source ID format');

export type OpfsRootDirectoryProvider = () => Promise<FileSystemDirectoryHandle>;
type SourceOperationLock = <T>(sourceId: string, execute: () => Promise<T>) => Promise<T>;

interface OpfsAudioSourceRepositoryOptions {
  readonly rootDirectoryProvider?: OpfsRootDirectoryProvider;
  readonly sourceOperationLock?: SourceOperationLock;
}

interface SourceFileOperation {
  readonly directory: FileSystemDirectoryHandle;
  readonly sourceId: string;
}

interface WriteSourceFileOperation extends SourceFileOperation {
  readonly blob: Blob;
  readonly expectedByteLength: number;
}

export class OpfsAudioSourceRepository implements IAudioSourceRepository {
  private readonly rootDirectoryProvider: OpfsRootDirectoryProvider;
  private readonly sourceOperationLock: SourceOperationLock;

  constructor({
    rootDirectoryProvider = getBrowserOpfsRootDirectory,
    sourceOperationLock = runWithBrowserSourceLock,
  }: OpfsAudioSourceRepositoryOptions = {}) {
    this.rootDirectoryProvider = rootDirectoryProvider;
    this.sourceOperationLock = sourceOperationLock;
  }

  async create({ metadata, blob }: CreateAudioSourceRequest): Promise<void> {
    const validatedMetadata = this.validateMetadata(metadata);
    this.validateBlob(blob);
    this.validateSourceByteLength({ metadata: validatedMetadata, blob });

    await this.runStorageOperation({ operation: 'create', sourceId: validatedMetadata.id }, () =>
      this.sourceOperationLock(validatedMetadata.id, async () => {
        const directory = await this.getAudioSourceDirectory(true);
        if (!directory) {
          throw this.createStorageOperationError({
            operation: 'create-directory',
            sourceId: validatedMetadata.id,
          });
        }

        if (await this.getFileHandleIfExists({ directory, sourceId: validatedMetadata.id })) {
          throw new AudioSourceRepositoryError({
            code: AudioSourceRepositoryErrorCode.SOURCE_ALREADY_EXISTS,
            message: `이미 저장된 오디오 Source입니다: ${validatedMetadata.id}`,
            details: { sourceId: validatedMetadata.id },
          });
        }

        await directory.getFileHandle(validatedMetadata.id, { create: true });
        try {
          await this.writeAndVerifySourceFile({
            directory,
            sourceId: validatedMetadata.id,
            blob,
            expectedByteLength: validatedMetadata.byteLength,
          });
        } catch (cause) {
          await this.cleanupFailedCreate({ directory, sourceId: validatedMetadata.id }, cause);
          throw cause;
        }
      })
    );
  }

  async load(metadata: ProjectAudioSource): Promise<Blob | null> {
    const validatedMetadata = this.validateMetadata(metadata);

    return this.runStorageOperation({ operation: 'load', sourceId: validatedMetadata.id }, () =>
      this.sourceOperationLock(validatedMetadata.id, async () => {
        const directory = await this.getAudioSourceDirectory(false);
        if (!directory) {
          return null;
        }

        const fileHandle = await this.getFileHandleIfExists({ directory, sourceId: validatedMetadata.id });
        if (!fileHandle) {
          return null;
        }

        const storedFile = await fileHandle.getFile();
        if (storedFile.size !== validatedMetadata.byteLength) {
          throw new AudioSourceRepositoryError({
            code: AudioSourceRepositoryErrorCode.STORED_SOURCE_BYTE_LENGTH_MISMATCH,
            message: `저장된 오디오 Source 크기가 metadata와 다릅니다: ${validatedMetadata.id}`,
            details: {
              actualByteLength: storedFile.size,
              expectedByteLength: validatedMetadata.byteLength,
              sourceId: validatedMetadata.id,
            },
          });
        }

        return new Blob([storedFile], { type: validatedMetadata.mimeType });
      })
    );
  }

  async delete(sourceId: string): Promise<void> {
    const validatedSourceId = this.validateSourceId(sourceId);

    await this.runStorageOperation({ operation: 'delete', sourceId: validatedSourceId }, () =>
      this.sourceOperationLock(validatedSourceId, async () => {
        const directory = await this.getAudioSourceDirectory(false);
        if (!directory) {
          return;
        }

        try {
          await directory.removeEntry(validatedSourceId);
        } catch (cause) {
          if (!isNotFoundError(cause)) {
            throw cause;
          }
        }
      })
    );
  }

  private validateMetadata(metadata: ProjectAudioSource): ProjectAudioSource {
    const result = ProjectAudioSourceSchema.safeParse(metadata);
    if (result.success) {
      return result.data;
    }

    throw new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.INVALID_SOURCE_METADATA,
      message: '오디오 Source metadata가 유효하지 않습니다.',
      details: { issues: result.error.issues },
      cause: result.error,
    });
  }

  private validateSourceId(sourceId: string): string {
    const result = SourceIdSchema.safeParse(sourceId);
    if (result.success) {
      return result.data;
    }

    throw new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.INVALID_SOURCE_ID,
      message: `오디오 Source ID가 유효하지 않습니다: ${sourceId}`,
      details: { sourceId },
      cause: result.error,
    });
  }

  private validateBlob(blob: Blob): void {
    if (typeof globalThis.Blob === 'function' && blob instanceof globalThis.Blob) {
      return;
    }

    throw new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.INVALID_SOURCE_BLOB,
      message: '오디오 Source 원본이 Blob 형식이 아닙니다.',
    });
  }

  private validateSourceByteLength({ metadata, blob }: CreateAudioSourceRequest): void {
    if (metadata.byteLength === blob.size) {
      return;
    }

    throw new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.SOURCE_BYTE_LENGTH_MISMATCH,
      message: `오디오 Source metadata와 Blob 크기가 다릅니다: ${metadata.id}`,
      details: {
        blobByteLength: blob.size,
        metadataByteLength: metadata.byteLength,
        sourceId: metadata.id,
      },
    });
  }

  private async getAudioSourceDirectory(create: boolean): Promise<FileSystemDirectoryHandle | null> {
    let directory = await this.rootDirectoryProvider();

    for (const directoryName of OPFS_DIRECTORY_PATH) {
      try {
        directory = await directory.getDirectoryHandle(directoryName, { create });
      } catch (cause) {
        if (!create && isNotFoundError(cause)) {
          return null;
        }
        throw cause;
      }
    }

    return directory;
  }

  private async getFileHandleIfExists({
    directory,
    sourceId,
  }: SourceFileOperation): Promise<FileSystemFileHandle | null> {
    try {
      return await directory.getFileHandle(sourceId);
    } catch (cause) {
      if (isNotFoundError(cause)) {
        return null;
      }
      throw cause;
    }
  }

  private async writeAndVerifySourceFile({
    directory,
    sourceId,
    blob,
    expectedByteLength,
  }: WriteSourceFileOperation): Promise<void> {
    const fileHandle = await directory.getFileHandle(sourceId);
    const writable = await fileHandle.createWritable();

    try {
      await writable.write(blob);
      await writable.close();
    } catch (cause) {
      if (typeof writable.abort === 'function') {
        await writable.abort(cause).catch(() => undefined);
      }
      throw cause;
    }

    const storedFile = await fileHandle.getFile();
    if (storedFile.size === expectedByteLength) {
      return;
    }

    throw new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.STORAGE_OPERATION_FAILED,
      message: `오디오 Source 쓰기 검증에 실패했습니다: ${sourceId}`,
      details: {
        actualByteLength: storedFile.size,
        expectedByteLength,
        operation: 'verify-create',
        sourceId,
      },
    });
  }

  private async cleanupFailedCreate({ directory, sourceId }: SourceFileOperation, cause: unknown): Promise<void> {
    try {
      await directory.removeEntry(sourceId);
    } catch (cleanupCause) {
      if (isNotFoundError(cleanupCause)) {
        return;
      }

      throw new AudioSourceRepositoryError({
        code: AudioSourceRepositoryErrorCode.STORAGE_OPERATION_FAILED,
        message: `실패한 오디오 Source 파일을 정리하지 못했습니다: ${sourceId}`,
        details: {
          cleanupErrorName: getErrorName(cleanupCause),
          operation: 'cleanup-create',
          sourceId,
          writeErrorName: getErrorName(cause),
        },
        cause: new AggregateError([cause, cleanupCause], '오디오 Source 생성과 정리가 모두 실패했습니다.'),
      });
    }
  }

  private async runStorageOperation<T>(
    context: { readonly operation: string; readonly sourceId: string },
    execute: () => Promise<T>
  ): Promise<T> {
    try {
      return await execute();
    } catch (cause) {
      if (cause instanceof AudioSourceRepositoryError) {
        throw cause;
      }

      throw this.createStorageOperationError({ ...context, cause });
    }
  }

  private createStorageOperationError({
    operation,
    sourceId,
    cause,
  }: {
    readonly operation: string;
    readonly sourceId: string;
    readonly cause?: unknown;
  }): AudioSourceRepositoryError {
    return new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.STORAGE_OPERATION_FAILED,
      message: `오디오 Source 저장소 작업에 실패했습니다: ${operation}`,
      details: { errorName: getErrorName(cause), operation, sourceId },
      cause,
    });
  }
}

async function getBrowserOpfsRootDirectory(): Promise<FileSystemDirectoryHandle> {
  const storageManager = globalThis.navigator?.storage;
  if (!storageManager || typeof storageManager.getDirectory !== 'function') {
    throw new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.STORAGE_UNAVAILABLE,
      message: '이 환경에서는 OPFS 오디오 Source 저장소를 사용할 수 없습니다.',
    });
  }

  return storageManager.getDirectory();
}

async function runWithBrowserSourceLock<T>(sourceId: string, execute: () => Promise<T>): Promise<T> {
  const lockManager = globalThis.navigator?.locks;
  if (!lockManager || typeof lockManager.request !== 'function') {
    throw new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.STORAGE_UNAVAILABLE,
      message: '이 환경에서는 OPFS 오디오 Source 저장소의 동시성 보호를 사용할 수 없습니다.',
    });
  }

  return lockManager.request(`${SOURCE_OPERATION_LOCK_PREFIX}${sourceId}`, { mode: 'exclusive' }, execute);
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotFoundError';
}

function getErrorName(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
    ? error.name
    : undefined;
}
