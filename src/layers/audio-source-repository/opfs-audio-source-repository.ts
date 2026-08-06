import { z } from 'zod';
import { ProjectAudioSourceSchema, type ProjectAudioSource } from '../shared/types/project-document.schema';
import { calculateBlobSha256, Sha256UnavailableError } from '../shared/utils/calculate-blob-sha256';
import { AudioSourceRepositoryError, AudioSourceRepositoryErrorCode } from './errors';
import type { CreateAudioSourceRequest, IAudioSourceRepository } from './i-audio-source-repository';

const LEGACY_OPFS_DIRECTORY_PATH = ['drop-ai', 'audio-sources', 'v1'] as const;
const CONTENT_OPFS_DIRECTORY_PATH = ['drop-ai', 'audio-sources', 'v2'] as const;
const CONTENT_BLOB_DIRECTORY_NAME = 'blobs';
const CONTENT_MANIFEST_DIRECTORY_NAME = 'manifests';
const STORAGE_OPERATION_LOCK_PREFIX = 'drop-ai:audio-source:v2:';
const SOURCE_LOCK_KEY_PREFIX = 'source:';
const CONTENT_LOCK_KEY_PREFIX = 'content:';
const MANIFEST_VERSION = 1;
const SourceIdSchema = z.uuid('Invalid Source ID format');
const ContentHashSchema = z.string().regex(/^[a-f0-9]{64}$/u, 'Invalid SHA-256 content hash');
const ContentManifestSchema = z.object({
  version: z.literal(MANIFEST_VERSION),
  contentHash: ContentHashSchema,
  byteLength: z.number().int().nonnegative(),
});

type ContentManifest = z.infer<typeof ContentManifestSchema>;
export type OpfsRootDirectoryProvider = () => Promise<FileSystemDirectoryHandle>;
type StorageOperationLock = <T>(storageKey: string, execute: () => Promise<T>) => Promise<T>;
type ContentHashCalculator = (blob: Blob) => Promise<string>;

interface OpfsAudioSourceRepositoryOptions {
  readonly rootDirectoryProvider?: OpfsRootDirectoryProvider;
  readonly storageOperationLock?: StorageOperationLock;
  readonly contentHashCalculator?: ContentHashCalculator;
}

interface ContentDirectories {
  readonly blobs: FileSystemDirectoryHandle;
  readonly manifests: FileSystemDirectoryHandle;
}

interface IterableDirectoryHandle extends FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface FileOperation {
  readonly directory: FileSystemDirectoryHandle;
  readonly fileName: string;
}

interface WriteFileOperation extends FileOperation {
  readonly blob: Blob;
  readonly expectedByteLength: number;
  readonly sourceId: string;
}

export class OpfsAudioSourceRepository implements IAudioSourceRepository {
  private readonly rootDirectoryProvider: OpfsRootDirectoryProvider;
  private readonly storageOperationLock: StorageOperationLock;
  private readonly contentHashCalculator: ContentHashCalculator;

  constructor({
    rootDirectoryProvider = getBrowserOpfsRootDirectory,
    storageOperationLock = runWithBrowserStorageLock,
    contentHashCalculator = calculateAudioSourceContentHash,
  }: OpfsAudioSourceRepositoryOptions = {}) {
    this.rootDirectoryProvider = rootDirectoryProvider;
    this.storageOperationLock = storageOperationLock;
    this.contentHashCalculator = contentHashCalculator;
  }

  async create({ metadata, blob }: CreateAudioSourceRequest): Promise<void> {
    const validatedMetadata = this.validateMetadata(metadata);
    this.validateBlob(blob);
    this.validateSourceByteLength({ metadata: validatedMetadata, blob });

    await this.runStorageOperation({ operation: 'create', sourceId: validatedMetadata.id }, async () => {
      const contentHash = this.validateContentHash(await this.contentHashCalculator(blob));
      await this.withSourceLock(validatedMetadata.id, async () => {
        const directories = await this.getContentDirectories(true);
        if (!directories) {
          throw this.createStorageOperationError({
            operation: 'create-directory',
            sourceId: validatedMetadata.id,
          });
        }

        if (
          (await this.getFileHandleIfExists({
            directory: directories.manifests,
            fileName: validatedMetadata.id,
          })) ||
          (await this.getLegacySourceFile(validatedMetadata.id))
        ) {
          throw new AudioSourceRepositoryError({
            code: AudioSourceRepositoryErrorCode.SOURCE_ALREADY_EXISTS,
            message: `이미 저장된 오디오 Source입니다: ${validatedMetadata.id}`,
            details: { sourceId: validatedMetadata.id },
          });
        }

        await this.withContentLock(contentHash, () =>
          this.createContentReference({ directories, metadata: validatedMetadata, blob, contentHash })
        );
      });
    });
  }

  async load(metadata: ProjectAudioSource): Promise<Blob | null> {
    const validatedMetadata = this.validateMetadata(metadata);

    return this.runStorageOperation({ operation: 'load', sourceId: validatedMetadata.id }, () =>
      this.withSourceLock(validatedMetadata.id, async () => {
        const directories = await this.getContentDirectories(false);
        const manifest = directories
          ? await this.readManifestIfExists(directories.manifests, validatedMetadata.id)
          : null;

        if (!manifest || !directories) {
          return this.loadLegacySource(validatedMetadata);
        }

        return this.withContentLock(manifest.contentHash, () =>
          this.loadContentBlob({ directories, manifest, metadata: validatedMetadata })
        );
      })
    );
  }

  async delete(sourceId: string): Promise<void> {
    const validatedSourceId = this.validateSourceId(sourceId);

    await this.runStorageOperation({ operation: 'delete', sourceId: validatedSourceId }, () =>
      this.withSourceLock(validatedSourceId, async () => {
        const directories = await this.getContentDirectories(false);
        const manifest = directories ? await this.readManifestIfExists(directories.manifests, validatedSourceId) : null;

        if (!manifest || !directories) {
          await this.deleteLegacySource(validatedSourceId);
          return;
        }

        await this.withContentLock(manifest.contentHash, async () => {
          await this.removeEntryIfExists(directories.manifests, validatedSourceId);

          // 같은 content를 참조하는 manifest가 남아 있으면 공유 바이트를 보존해야 한다.
          if (!(await this.hasManifestReference(directories.manifests, manifest.contentHash))) {
            await this.removeEntryIfExists(directories.blobs, manifest.contentHash);
          }
        });
      })
    );
  }

  private async createContentReference({
    directories,
    metadata,
    blob,
    contentHash,
  }: {
    readonly directories: ContentDirectories;
    readonly metadata: ProjectAudioSource;
    readonly blob: Blob;
    readonly contentHash: string;
  }): Promise<void> {
    let contentCreated = false;
    const existingContent = await this.getFileHandleIfExists({ directory: directories.blobs, fileName: contentHash });

    if (existingContent) {
      await this.verifyContentFile({ fileHandle: existingContent, contentHash, metadata });
    } else {
      await directories.blobs.getFileHandle(contentHash, { create: true });
      contentCreated = true;
      try {
        await this.writeAndVerifyFile({
          directory: directories.blobs,
          fileName: contentHash,
          blob,
          expectedByteLength: metadata.byteLength,
          sourceId: metadata.id,
        });
      } catch (cause) {
        await this.cleanupFailedCreate({ directory: directories.blobs, fileName: contentHash }, metadata.id, cause);
        throw cause;
      }
    }

    try {
      // manifest를 마지막에 기록하면 중단된 쓰기가 완성되지 않은 Source로 노출되지 않는다.
      await this.writeManifest(directories.manifests, metadata.id, {
        version: MANIFEST_VERSION,
        contentHash,
        byteLength: metadata.byteLength,
      });
    } catch (cause) {
      if (contentCreated && !(await this.hasManifestReference(directories.manifests, contentHash))) {
        await this.cleanupFailedCreate({ directory: directories.blobs, fileName: contentHash }, metadata.id, cause);
      }
      throw cause;
    }
  }

  private async loadContentBlob({
    directories,
    manifest,
    metadata,
  }: {
    readonly directories: ContentDirectories;
    readonly manifest: ContentManifest;
    readonly metadata: ProjectAudioSource;
  }): Promise<Blob | null> {
    if (manifest.byteLength !== metadata.byteLength) {
      throw this.createByteLengthMismatchError(metadata.id, manifest.byteLength, metadata.byteLength);
    }

    const fileHandle = await this.getFileHandleIfExists({
      directory: directories.blobs,
      fileName: manifest.contentHash,
    });
    if (!fileHandle) {
      return null;
    }

    const storedFile = await fileHandle.getFile();
    if (storedFile.size !== metadata.byteLength) {
      throw this.createByteLengthMismatchError(metadata.id, storedFile.size, metadata.byteLength);
    }

    const storedBlob = new Blob([storedFile], { type: metadata.mimeType });
    const storedContentHash = this.validateContentHash(await this.contentHashCalculator(storedBlob));
    if (storedContentHash !== manifest.contentHash) {
      throw new AudioSourceRepositoryError({
        code: AudioSourceRepositoryErrorCode.STORAGE_OPERATION_FAILED,
        message: `저장된 오디오 Source hash가 manifest와 다릅니다: ${metadata.id}`,
        details: { operation: 'verify-load-hash', sourceId: metadata.id },
      });
    }

    return storedBlob;
  }

  private async loadLegacySource(metadata: ProjectAudioSource): Promise<Blob | null> {
    const fileHandle = await this.getLegacySourceFile(metadata.id);
    if (!fileHandle) {
      return null;
    }

    const storedFile = await fileHandle.getFile();
    if (storedFile.size !== metadata.byteLength) {
      throw this.createByteLengthMismatchError(metadata.id, storedFile.size, metadata.byteLength);
    }

    return new Blob([storedFile], { type: metadata.mimeType });
  }

  private async verifyContentFile({
    fileHandle,
    contentHash,
    metadata,
  }: {
    readonly fileHandle: FileSystemFileHandle;
    readonly contentHash: string;
    readonly metadata: ProjectAudioSource;
  }): Promise<void> {
    const storedFile = await fileHandle.getFile();
    const storedBlob = new Blob([storedFile]);
    const storedHash = this.validateContentHash(await this.contentHashCalculator(storedBlob));
    if (storedFile.size === metadata.byteLength && storedHash === contentHash) {
      return;
    }

    throw new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.STORAGE_OPERATION_FAILED,
      message: `저장된 content blob 검증에 실패했습니다: ${contentHash}`,
      details: { operation: 'verify-existing-content', sourceId: metadata.id },
    });
  }

  private async writeManifest(
    directory: FileSystemDirectoryHandle,
    sourceId: string,
    manifest: ContentManifest
  ): Promise<void> {
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    await directory.getFileHandle(sourceId, { create: true });
    try {
      await this.writeAndVerifyFile({
        directory,
        fileName: sourceId,
        blob: manifestBlob,
        expectedByteLength: manifestBlob.size,
        sourceId,
      });
    } catch (cause) {
      await this.cleanupFailedCreate({ directory, fileName: sourceId }, sourceId, cause);
      throw cause;
    }
  }

  private async readManifestIfExists(
    directory: FileSystemDirectoryHandle,
    sourceId: string
  ): Promise<ContentManifest | null> {
    const fileHandle = await this.getFileHandleIfExists({ directory, fileName: sourceId });
    if (!fileHandle) {
      return null;
    }

    const manifestFile = await fileHandle.getFile();
    return ContentManifestSchema.parse(JSON.parse(await manifestFile.text()) as unknown);
  }

  private async hasManifestReference(directory: FileSystemDirectoryHandle, contentHash: string): Promise<boolean> {
    const iterableDirectory = directory as IterableDirectoryHandle;
    for await (const [, handle] of iterableDirectory.entries()) {
      if (handle.kind !== 'file') {
        continue;
      }
      const fileHandle = handle as FileSystemFileHandle;
      const manifestFile = await fileHandle.getFile();
      const result = ContentManifestSchema.safeParse(JSON.parse(await manifestFile.text()) as unknown);
      if (result.success && result.data.contentHash === contentHash) {
        return true;
      }
    }
    return false;
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

  private validateContentHash(contentHash: string): string {
    return ContentHashSchema.parse(contentHash);
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

  private async getContentDirectories(create: boolean): Promise<ContentDirectories | null> {
    const versionDirectory = await this.getDirectory(CONTENT_OPFS_DIRECTORY_PATH, create);
    if (!versionDirectory) {
      return null;
    }

    try {
      const blobs = await versionDirectory.getDirectoryHandle(CONTENT_BLOB_DIRECTORY_NAME, { create });
      const manifests = await versionDirectory.getDirectoryHandle(CONTENT_MANIFEST_DIRECTORY_NAME, { create });
      return { blobs, manifests };
    } catch (cause) {
      if (!create && isNotFoundError(cause)) {
        return null;
      }
      throw cause;
    }
  }

  private async getDirectory(path: readonly string[], create: boolean): Promise<FileSystemDirectoryHandle | null> {
    let directory = await this.rootDirectoryProvider();
    for (const directoryName of path) {
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

  private async getLegacySourceFile(sourceId: string): Promise<FileSystemFileHandle | null> {
    const directory = await this.getDirectory(LEGACY_OPFS_DIRECTORY_PATH, false);
    return directory ? this.getFileHandleIfExists({ directory, fileName: sourceId }) : null;
  }

  private async deleteLegacySource(sourceId: string): Promise<void> {
    const directory = await this.getDirectory(LEGACY_OPFS_DIRECTORY_PATH, false);
    if (directory) {
      await this.removeEntryIfExists(directory, sourceId);
    }
  }

  private async getFileHandleIfExists({ directory, fileName }: FileOperation): Promise<FileSystemFileHandle | null> {
    try {
      return await directory.getFileHandle(fileName);
    } catch (cause) {
      if (isNotFoundError(cause)) {
        return null;
      }
      throw cause;
    }
  }

  private async removeEntryIfExists(directory: FileSystemDirectoryHandle, fileName: string): Promise<void> {
    try {
      await directory.removeEntry(fileName);
    } catch (cause) {
      if (!isNotFoundError(cause)) {
        throw cause;
      }
    }
  }

  private async writeAndVerifyFile({
    directory,
    fileName,
    blob,
    expectedByteLength,
    sourceId,
  }: WriteFileOperation): Promise<void> {
    const fileHandle = await directory.getFileHandle(fileName);
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

  private async cleanupFailedCreate({ directory, fileName }: FileOperation, sourceId: string, cause: unknown) {
    try {
      await directory.removeEntry(fileName);
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

  private createByteLengthMismatchError(
    sourceId: string,
    actualByteLength: number,
    expectedByteLength: number
  ): AudioSourceRepositoryError {
    return new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.STORED_SOURCE_BYTE_LENGTH_MISMATCH,
      message: `저장된 오디오 Source 크기가 metadata와 다릅니다: ${sourceId}`,
      details: { actualByteLength, expectedByteLength, sourceId },
    });
  }

  private withSourceLock<T>(sourceId: string, execute: () => Promise<T>): Promise<T> {
    return this.storageOperationLock(`${SOURCE_LOCK_KEY_PREFIX}${sourceId}`, execute);
  }

  private withContentLock<T>(contentHash: string, execute: () => Promise<T>): Promise<T> {
    return this.storageOperationLock(`${CONTENT_LOCK_KEY_PREFIX}${contentHash}`, execute);
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

async function runWithBrowserStorageLock<T>(storageKey: string, execute: () => Promise<T>): Promise<T> {
  const lockManager = globalThis.navigator?.locks;
  if (!lockManager || typeof lockManager.request !== 'function') {
    throw new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.STORAGE_UNAVAILABLE,
      message: '이 환경에서는 OPFS 오디오 Source 저장소의 동시성 보호를 사용할 수 없습니다.',
    });
  }

  return lockManager.request(`${STORAGE_OPERATION_LOCK_PREFIX}${storageKey}`, { mode: 'exclusive' }, execute);
}

async function calculateAudioSourceContentHash(blob: Blob): Promise<string> {
  try {
    return await calculateBlobSha256(blob);
  } catch (cause) {
    if (!(cause instanceof Sha256UnavailableError)) {
      throw cause;
    }
    throw new AudioSourceRepositoryError({
      code: AudioSourceRepositoryErrorCode.STORAGE_UNAVAILABLE,
      message: '이 환경에서는 오디오 Source SHA-256 계산을 사용할 수 없습니다.',
      cause,
    });
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotFoundError';
}

function getErrorName(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
    ? error.name
    : undefined;
}
