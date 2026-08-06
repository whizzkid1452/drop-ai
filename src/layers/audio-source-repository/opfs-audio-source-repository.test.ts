import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectAudioSource } from '../shared/types/project-document.schema';
import { AudioSourceRepositoryErrorCode } from './errors';
import { OpfsAudioSourceRepository } from './opfs-audio-source-repository';

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const SECOND_SOURCE_ID = '22222222-2222-4222-8222-222222222222';

type StoredBlobTransform = (blob: Blob) => Blob;
type StorageOperationLock = <T>(storageKey: string, execute: () => Promise<T>) => Promise<T>;

interface MemoryFileHandleOptions {
  readonly closeError?: Error;
  readonly createWritableError?: Error;
  readonly storedBlobTransform?: StoredBlobTransform;
  readonly writeError?: Error;
}

class MemoryFileHandle {
  readonly kind = 'file';
  blob = new Blob();

  constructor(private readonly options: MemoryFileHandleOptions = {}) {}

  async createWritable(): Promise<FileSystemWritableFileStream> {
    if (this.options.createWritableError) {
      throw this.options.createWritableError;
    }

    let pendingBlob = this.blob;
    const writable = {
      write: async (value: FileSystemWriteChunkType): Promise<void> => {
        if (this.options.writeError) {
          throw this.options.writeError;
        }
        if (!(value instanceof Blob)) {
          throw new TypeError('테스트 저장소는 Blob 쓰기만 지원합니다.');
        }
        pendingBlob = value;
      },
      close: async (): Promise<void> => {
        if (this.options.closeError) {
          throw this.options.closeError;
        }
        this.blob = this.options.storedBlobTransform?.(pendingBlob) ?? pendingBlob;
      },
      abort: async (): Promise<void> => undefined,
    };

    return writable as unknown as FileSystemWritableFileStream;
  }

  async getFile(): Promise<File> {
    return this.blob as File;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

class MemoryDirectoryHandle {
  readonly kind = 'directory';
  readonly directories = new Map<string, MemoryDirectoryHandle>();
  readonly files = new Map<string, MemoryFileHandle>();

  constructor(
    private readonly createFile: () => MemoryFileHandle = () => new MemoryFileHandle(),
    private readonly removeEntryError?: Error
  ) {}

  async getDirectoryHandle(
    name: string,
    options: FileSystemGetDirectoryOptions = {}
  ): Promise<FileSystemDirectoryHandle> {
    const directory = this.directories.get(name);
    if (directory) {
      return directory as unknown as FileSystemDirectoryHandle;
    }
    if (!options.create) {
      throw new DOMException('Directory not found', 'NotFoundError');
    }

    const createdDirectory = new MemoryDirectoryHandle(this.createFile, this.removeEntryError);
    this.directories.set(name, createdDirectory);
    return createdDirectory as unknown as FileSystemDirectoryHandle;
  }

  async getFileHandle(name: string, options: FileSystemGetFileOptions = {}): Promise<FileSystemFileHandle> {
    const file = this.files.get(name);
    if (file) {
      return file as unknown as FileSystemFileHandle;
    }
    if (!options.create) {
      throw new DOMException('File not found', 'NotFoundError');
    }

    const createdFile = this.createFile();
    this.files.set(name, createdFile);
    return createdFile as unknown as FileSystemFileHandle;
  }

  async removeEntry(name: string): Promise<void> {
    if (this.removeEntryError) {
      throw this.removeEntryError;
    }

    if (this.files.delete(name) || this.directories.delete(name)) {
      return;
    }

    throw new DOMException('Entry not found', 'NotFoundError');
  }

  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    for (const [name, directory] of this.directories) {
      yield [name, directory as unknown as FileSystemDirectoryHandle];
    }
    for (const [name, file] of this.files) {
      yield [name, file as unknown as FileSystemFileHandle];
    }
  }
}

function createMetadata(overrides: Partial<ProjectAudioSource> = {}): ProjectAudioSource {
  return {
    id: SOURCE_ID,
    fileName: 'source.wav',
    mimeType: 'audio/wav',
    byteLength: 4,
    durationSeconds: 1,
    ...overrides,
  };
}

function createMemoryStorageOperationLock(): StorageOperationLock {
  const operationTails = new Map<string, Promise<void>>();

  return async <T>(sourceId: string, execute: () => Promise<T>): Promise<T> => {
    const previousTail = operationTails.get(sourceId) ?? Promise.resolve();
    const result = previousTail.catch(() => undefined).then(execute);
    const currentTail = result.then(
      () => undefined,
      () => undefined
    );
    operationTails.set(sourceId, currentTail);

    try {
      return await result;
    } finally {
      if (operationTails.get(sourceId) === currentTail) {
        operationTails.delete(sourceId);
      }
    }
  };
}

function createRepository(
  root: MemoryDirectoryHandle,
  storageOperationLock: StorageOperationLock = createMemoryStorageOperationLock()
): OpfsAudioSourceRepository {
  return new OpfsAudioSourceRepository({
    rootDirectoryProvider: async () => root as unknown as FileSystemDirectoryHandle,
    storageOperationLock,
  });
}

function getStoredContentBlob(root: MemoryDirectoryHandle): MemoryFileHandle {
  const contentDirectory = root.directories
    .get('drop-ai')
    ?.directories.get('audio-sources')
    ?.directories.get('v2')
    ?.directories.get('blobs');
  const file = contentDirectory?.files.values().next().value;
  if (!file) {
    throw new Error('테스트 content blob을 찾을 수 없습니다.');
  }
  return file;
}

function getContentDirectories(root: MemoryDirectoryHandle): {
  blobs: MemoryDirectoryHandle;
  manifests: MemoryDirectoryHandle;
} {
  const versionDirectory = root.directories.get('drop-ai')?.directories.get('audio-sources')?.directories.get('v2');
  const blobs = versionDirectory?.directories.get('blobs');
  const manifests = versionDirectory?.directories.get('manifests');
  if (!blobs || !manifests) {
    throw new Error('테스트 content-addressed 저장소를 찾을 수 없습니다.');
  }
  return { blobs, manifests };
}

describe('OpfsAudioSourceRepository', () => {
  it('같은 바이트를 여러 Source가 참조하면 content blob은 한 번만 저장한다', async () => {
    const root = new MemoryDirectoryHandle();
    const repository = createRepository(root);
    const firstMetadata = createMetadata();
    const secondMetadata = createMetadata({ id: SECOND_SOURCE_ID });

    await repository.create({ metadata: firstMetadata, blob: new Blob(['test']) });
    await repository.create({ metadata: secondMetadata, blob: new Blob(['test']) });

    const { blobs, manifests } = getContentDirectories(root);
    expect(blobs.files.size).toBe(1);
    expect(manifests.files.size).toBe(2);
    await expect((await repository.load(firstMetadata))?.text()).resolves.toBe('test');
    await expect((await repository.load(secondMetadata))?.text()).resolves.toBe('test');
  });

  it('공유 content blob은 마지막 Source가 삭제될 때 제거한다', async () => {
    const root = new MemoryDirectoryHandle();
    const repository = createRepository(root);
    const firstMetadata = createMetadata();
    const secondMetadata = createMetadata({ id: SECOND_SOURCE_ID });
    await repository.create({ metadata: firstMetadata, blob: new Blob(['test']) });
    await repository.create({ metadata: secondMetadata, blob: new Blob(['test']) });

    await repository.delete(firstMetadata.id);

    expect(getContentDirectories(root).blobs.files.size).toBe(1);
    await expect(repository.load(secondMetadata)).resolves.not.toBeNull();

    await repository.delete(secondMetadata.id);

    expect(getContentDirectories(root).blobs.files.size).toBe(0);
  });

  it('v1 경로에 저장된 기존 Source를 계속 불러온다', async () => {
    const root = new MemoryDirectoryHandle();
    const legacyDirectory = (await (
      await (
        await root.getDirectoryHandle('drop-ai', { create: true })
      ).getDirectoryHandle('audio-sources', {
        create: true,
      })
    ).getDirectoryHandle('v1', { create: true })) as unknown as MemoryDirectoryHandle;
    const legacyFile = (await legacyDirectory.getFileHandle(SOURCE_ID, {
      create: true,
    })) as unknown as MemoryFileHandle;
    legacyFile.blob = new Blob(['test']);

    await expect((await createRepository(root).load(createMetadata()))?.text()).resolves.toBe('test');
  });

  it('고정 경로에 저장하고 새 Repository 인스턴스에서 같은 바이트를 불러온다', async () => {
    const root = new MemoryDirectoryHandle();
    const metadata = createMetadata();
    const blob = new Blob(['test'], { type: metadata.mimeType });
    await createRepository(root).create({ metadata, blob });

    const loadedBlob = await createRepository(root).load(metadata);

    expect([...root.directories.keys()]).toEqual(['drop-ai']);
    expect([...(root.directories.get('drop-ai')?.directories.keys() ?? [])]).toEqual(['audio-sources']);
    expect([...(root.directories.get('drop-ai')?.directories.get('audio-sources')?.directories.keys() ?? [])]).toEqual([
      'v2',
    ]);
    expect(getStoredContentBlob(root)).toBeDefined();
    expect(loadedBlob?.type).toBe(metadata.mimeType);
    await expect(loadedBlob?.text()).resolves.toBe('test');
  });

  it('0바이트 Source를 저장하고 불러온다', async () => {
    const root = new MemoryDirectoryHandle();
    const metadata = createMetadata({ byteLength: 0, durationSeconds: 0 });

    await createRepository(root).create({ metadata, blob: new Blob([], { type: metadata.mimeType }) });

    await expect(createRepository(root).load(metadata)).resolves.toMatchObject({ size: 0, type: metadata.mimeType });
  });

  it('반환 Blob의 MIME type은 브라우저 Blob 규칙으로 정규화한다', async () => {
    const root = new MemoryDirectoryHandle();
    const repository = createRepository(root);
    const metadata = createMetadata({ mimeType: 'Audio/WAV' });
    await repository.create({ metadata, blob: new Blob(['test']) });

    await expect(repository.load(metadata)).resolves.toMatchObject({ type: 'audio/wav' });
  });

  it('잘못된 metadata를 파일 접근 전에 거부한다', async () => {
    const rootDirectoryProvider = vi.fn(
      async () => new MemoryDirectoryHandle() as unknown as FileSystemDirectoryHandle
    );
    const repository = new OpfsAudioSourceRepository({ rootDirectoryProvider });

    await expect(
      repository.create({ metadata: createMetadata({ id: 'invalid-source-id' }), blob: new Blob(['test']) })
    ).rejects.toMatchObject({ code: AudioSourceRepositoryErrorCode.INVALID_SOURCE_METADATA });
    expect(rootDirectoryProvider).not.toHaveBeenCalled();
  });

  it('Blob이 아닌 입력을 파일 접근 전에 거부한다', async () => {
    const rootDirectoryProvider = vi.fn(
      async () => new MemoryDirectoryHandle() as unknown as FileSystemDirectoryHandle
    );
    const repository = new OpfsAudioSourceRepository({ rootDirectoryProvider });

    await expect(repository.create({ metadata: createMetadata(), blob: {} as Blob })).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.INVALID_SOURCE_BLOB,
    });
    expect(rootDirectoryProvider).not.toHaveBeenCalled();
  });

  it('metadata와 Blob 크기가 다르면 파일 접근 전에 거부한다', async () => {
    const rootDirectoryProvider = vi.fn(
      async () => new MemoryDirectoryHandle() as unknown as FileSystemDirectoryHandle
    );
    const repository = new OpfsAudioSourceRepository({ rootDirectoryProvider });

    await expect(
      repository.create({ metadata: createMetadata({ byteLength: 3 }), blob: new Blob(['test']) })
    ).rejects.toMatchObject({ code: AudioSourceRepositoryErrorCode.SOURCE_BYTE_LENGTH_MISMATCH });
    expect(rootDirectoryProvider).not.toHaveBeenCalled();
  });

  it('중복 Source를 거부하고 기존 바이트를 덮어쓰지 않는다', async () => {
    const root = new MemoryDirectoryHandle();
    const repository = createRepository(root);
    const metadata = createMetadata();
    await repository.create({ metadata, blob: new Blob(['test']) });

    await expect(repository.create({ metadata, blob: new Blob(['nope']) })).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.SOURCE_ALREADY_EXISTS,
    });
    await expect((await repository.load(metadata))?.text()).resolves.toBe('test');
  });

  it('같은 Source의 동시 생성을 순서대로 처리해 기존 바이트를 보호한다', async () => {
    const root = new MemoryDirectoryHandle();
    const storageOperationLock = createMemoryStorageOperationLock();
    const lockRequest = vi.fn(
      (lockName: string, _options: LockOptions, execute: () => Promise<unknown>): Promise<unknown> =>
        storageOperationLock(lockName, execute)
    );
    vi.stubGlobal('navigator', {
      locks: { request: lockRequest },
      storage: { getDirectory: async () => root },
    });
    const firstRepository = new OpfsAudioSourceRepository();
    const secondRepository = new OpfsAudioSourceRepository();
    const metadata = createMetadata();

    const [firstResult, secondResult] = await Promise.allSettled([
      firstRepository.create({ metadata, blob: new Blob(['test']) }),
      secondRepository.create({ metadata, blob: new Blob(['next']) }),
    ]);

    expect(firstResult).toMatchObject({ status: 'fulfilled' });
    expect(secondResult).toMatchObject({
      status: 'rejected',
      reason: { code: AudioSourceRepositoryErrorCode.SOURCE_ALREADY_EXISTS },
    });
    await expect((await firstRepository.load(metadata))?.text()).resolves.toBe('test');
    expect(lockRequest).toHaveBeenCalledWith(
      `drop-ai:audio-source:v2:source:${SOURCE_ID}`,
      { mode: 'exclusive' },
      expect.any(Function)
    );
  });

  it('쓰기 뒤 크기 검증이 실패하면 생성한 파일을 정리한다', async () => {
    const root = new MemoryDirectoryHandle(() => new MemoryFileHandle({ storedBlobTransform: () => new Blob() }));
    const repository = createRepository(root);
    const metadata = createMetadata();

    await expect(repository.create({ metadata, blob: new Blob(['test']) })).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.STORAGE_OPERATION_FAILED,
      details: expect.objectContaining({ operation: 'verify-create', sourceId: SOURCE_ID }),
    });
    await expect(repository.load(metadata)).resolves.toBeNull();
  });

  it.each([
    { label: '쓰기 스트림 생성', options: { createWritableError: new Error('create writable failed') } },
    { label: '쓰기', options: { writeError: new Error('write failed') } },
    { label: 'close', options: { closeError: new Error('close failed') } },
  ])('$label 실패 시 생성한 파일을 정리한다', async ({ options }) => {
    const root = new MemoryDirectoryHandle(() => new MemoryFileHandle(options));
    const repository = createRepository(root);
    const metadata = createMetadata();

    await expect(repository.create({ metadata, blob: new Blob(['test']) })).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.STORAGE_OPERATION_FAILED,
      details: expect.objectContaining({ operation: 'create', sourceId: SOURCE_ID }),
    });
    await expect(repository.load(metadata)).resolves.toBeNull();
  });

  it('쓰기와 임시 파일 정리가 모두 실패하면 두 오류를 보존한다', async () => {
    const writeError = new DOMException('Write failed', 'InvalidStateError');
    const cleanupError = new DOMException('Cleanup failed', 'NoModificationAllowedError');
    const root = new MemoryDirectoryHandle(() => new MemoryFileHandle({ writeError }), cleanupError);
    const repository = createRepository(root);

    await expect(repository.create({ metadata: createMetadata(), blob: new Blob(['test']) })).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.STORAGE_OPERATION_FAILED,
      details: {
        cleanupErrorName: 'NoModificationAllowedError',
        operation: 'cleanup-create',
        sourceId: SOURCE_ID,
        writeErrorName: 'InvalidStateError',
      },
      cause: expect.any(AggregateError),
    });
  });

  it('저장된 바이트 크기가 metadata와 다르면 손상 오류를 반환한다', async () => {
    const root = new MemoryDirectoryHandle();
    const repository = createRepository(root);
    const metadata = createMetadata();
    await repository.create({ metadata, blob: new Blob(['test']) });
    getStoredContentBlob(root).blob = new Blob(['corrupt']);

    await expect(repository.load(metadata)).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.STORED_SOURCE_BYTE_LENGTH_MISMATCH,
      details: { actualByteLength: 7, expectedByteLength: 4, sourceId: SOURCE_ID },
    });
  });

  it('없는 Source 조회는 null이고 디렉터리를 만들지 않는다', async () => {
    const root = new MemoryDirectoryHandle();

    await expect(createRepository(root).load(createMetadata())).resolves.toBeNull();
    expect(root.directories.size).toBe(0);
  });

  it('Source 삭제와 반복 삭제를 모두 성공으로 처리한다', async () => {
    const root = new MemoryDirectoryHandle();
    const repository = createRepository(root);
    const metadata = createMetadata();
    await repository.create({ metadata, blob: new Blob(['test']) });

    await expect(repository.delete(SOURCE_ID)).resolves.toBeUndefined();
    await expect(repository.delete(SOURCE_ID)).resolves.toBeUndefined();
    await expect(repository.load(metadata)).resolves.toBeNull();
  });

  it('잘못된 Source ID 삭제를 파일 접근 전에 거부한다', async () => {
    const rootDirectoryProvider = vi.fn(
      async () => new MemoryDirectoryHandle() as unknown as FileSystemDirectoryHandle
    );
    const repository = new OpfsAudioSourceRepository({
      rootDirectoryProvider,
      storageOperationLock: createMemoryStorageOperationLock(),
    });

    await expect(repository.delete('invalid-source-id')).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.INVALID_SOURCE_ID,
    });
    expect(rootDirectoryProvider).not.toHaveBeenCalled();
  });

  it('NotFoundError가 아닌 파일 시스템 오류를 조용히 삼키지 않는다', async () => {
    const rootDirectoryProvider = async (): Promise<FileSystemDirectoryHandle> =>
      ({
        getDirectoryHandle: async () => {
          throw new DOMException('Permission denied', 'SecurityError');
        },
      }) as unknown as FileSystemDirectoryHandle;
    const repository = new OpfsAudioSourceRepository({
      rootDirectoryProvider,
      storageOperationLock: createMemoryStorageOperationLock(),
    });

    await expect(repository.load(createMetadata())).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.STORAGE_OPERATION_FAILED,
      details: expect.objectContaining({ errorName: 'SecurityError', operation: 'load', sourceId: SOURCE_ID }),
    });
  });

  it('OPFS API가 없으면 저장소 사용 불가 오류를 반환한다', async () => {
    vi.stubGlobal('navigator', {});

    await expect(
      new OpfsAudioSourceRepository({ storageOperationLock: createMemoryStorageOperationLock() }).load(createMetadata())
    ).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.STORAGE_UNAVAILABLE,
    });
  });

  it('Web Locks API가 없으면 저장소 사용 불가 오류를 반환한다', async () => {
    vi.stubGlobal('navigator', {
      storage: { getDirectory: async () => new MemoryDirectoryHandle() },
    });

    await expect(new OpfsAudioSourceRepository().load(createMetadata())).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.STORAGE_UNAVAILABLE,
    });
  });

  it('Root Directory 접근 실패를 작업 오류로 보존한다', async () => {
    const repository = new OpfsAudioSourceRepository({
      rootDirectoryProvider: async () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
      storageOperationLock: createMemoryStorageOperationLock(),
    });

    await expect(repository.create({ metadata: createMetadata(), blob: new Blob(['test']) })).rejects.toMatchObject({
      code: AudioSourceRepositoryErrorCode.STORAGE_OPERATION_FAILED,
      details: { errorName: 'QuotaExceededError', operation: 'create', sourceId: SOURCE_ID },
    });
  });
});
