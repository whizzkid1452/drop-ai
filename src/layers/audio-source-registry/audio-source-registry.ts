import { z } from 'zod';
import { ProjectAudioSourceSchema, type ProjectAudioSource } from '../shared/types/project-document.schema';
import { AudioSourceRegistryError } from './errors';
import type {
  AudioSourceAttachment,
  AudioSourceRegistration,
  IAudioSourceRegistry,
  RuntimeAudioSource,
} from './i-audio-source-registry';
import type { IObjectUrlAdapter } from './i-object-url-adapter';

const RegionIdSchema = z.uuid('Invalid Region ID format');

interface StoredAudioSource {
  readonly metadata: ProjectAudioSource;
  readonly objectUrl: string;
  isCommitted: boolean;
  readonly regionIds: Set<string>;
}

export class AudioSourceRegistry implements IAudioSourceRegistry {
  private readonly sources = new Map<string, StoredAudioSource>();
  private readonly sourceIdByRegionId = new Map<string, string>();

  constructor(private readonly objectUrlAdapter: IObjectUrlAdapter) {}

  stage(registration: AudioSourceRegistration): RuntimeAudioSource {
    return this.register(registration, false);
  }

  restoreCommitted(registration: AudioSourceRegistration): RuntimeAudioSource {
    return this.register(registration, true);
  }

  resolve(sourceId: string): RuntimeAudioSource | null {
    const source = this.sources.get(sourceId);
    return source ? this.createRuntimeSource(source) : null;
  }

  listCommittedMetadata(): ReadonlyArray<Readonly<ProjectAudioSource>> {
    return [...this.sources.values()].filter(source => source.isCommitted).map(source => ({ ...source.metadata }));
  }

  attach({ sourceId, regionId }: AudioSourceAttachment): void {
    this.assertValidRegionId(regionId);
    const source = this.getRequiredSource(sourceId);
    const attachedSourceId = this.sourceIdByRegionId.get(regionId);

    if (attachedSourceId) {
      throw new AudioSourceRegistryError({
        code: 'REGION_ID_CONFLICT',
        message: `Region ID가 이미 다른 Source 연결에 사용 중입니다: ${regionId}`,
        details: { attachedSourceId, regionId, requestedSourceId: sourceId },
      });
    }

    source.regionIds.add(regionId);
    source.isCommitted = true;
    this.sourceIdByRegionId.set(regionId, sourceId);
  }

  detach({ sourceId, regionId }: AudioSourceAttachment): void {
    this.assertValidRegionId(regionId);
    const source = this.getRequiredSource(sourceId);

    if (this.sourceIdByRegionId.get(regionId) !== sourceId) {
      throw new AudioSourceRegistryError({
        code: 'REGION_ATTACHMENT_NOT_FOUND',
        message: `Source와 Region의 연결을 찾을 수 없습니다: ${sourceId} / ${regionId}`,
        details: { sourceId, regionId },
      });
    }

    source.regionIds.delete(regionId);
    this.sourceIdByRegionId.delete(regionId);
  }

  discardPending(sourceId: string): void {
    const source = this.sources.get(sourceId);
    if (!source) {
      return;
    }

    if (source.isCommitted) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_ALREADY_COMMITTED',
        message: `연결된 적이 있는 Source는 pending 정리로 제거할 수 없습니다: ${sourceId}`,
        details: { sourceId },
      });
    }

    this.removeSourceAndRevoke(sourceId, source);
  }

  purgeUnused(sourceId: string): void {
    const source = this.getRequiredSource(sourceId);

    if (!source.isCommitted) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_NOT_COMMITTED',
        message: `pending Source는 명시적 미사용 정리 대상으로 처리할 수 없습니다: ${sourceId}`,
        details: { sourceId },
      });
    }

    if (source.regionIds.size > 0) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_STILL_ATTACHED',
        message: `Region이 연결된 Source는 제거할 수 없습니다: ${sourceId}`,
        details: { regionIds: [...source.regionIds], sourceId },
      });
    }

    this.removeSourceAndRevoke(sourceId, source);
  }

  clear(): void {
    const sources = [...this.sources.entries()];
    let firstRevocationError: unknown;
    const failedSourceIds: string[] = [];
    sources.forEach(([sourceId, source]) => {
      try {
        this.objectUrlAdapter.revokeObjectUrl(source.objectUrl);
      } catch (error) {
        firstRevocationError ??= error;
        failedSourceIds.push(sourceId);
        return;
      }

      this.sources.delete(sourceId);
      source.regionIds.forEach(regionId => this.sourceIdByRegionId.delete(regionId));
    });

    if (firstRevocationError) {
      throw new AudioSourceRegistryError({
        code: 'OBJECT_URL_REVOCATION_FAILED',
        message: '일부 오디오 Source의 Object URL을 해제하지 못했습니다.',
        details: { failedSourceIds, sourceCount: sources.length },
        cause: firstRevocationError,
      });
    }
  }

  private register(registration: AudioSourceRegistration, isCommitted: boolean): RuntimeAudioSource {
    const metadata = this.parseMetadata(registration.metadata);
    this.assertValidBlob(registration.blob);

    if (this.sources.has(metadata.id)) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_ID_CONFLICT',
        message: `이미 등록된 Source ID입니다: ${metadata.id}`,
        details: { sourceId: metadata.id },
      });
    }

    if (metadata.byteLength !== registration.blob.size) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_BYTE_LENGTH_MISMATCH',
        message: `Source metadata와 Blob의 byteLength가 다릅니다: ${metadata.id}`,
        details: {
          blobByteLength: registration.blob.size,
          metadataByteLength: metadata.byteLength,
          sourceId: metadata.id,
        },
      });
    }

    const objectUrl = this.createObjectUrl(registration.blob, metadata.id);
    const source: StoredAudioSource = {
      metadata: { ...metadata },
      objectUrl,
      isCommitted,
      regionIds: new Set(),
    };
    this.sources.set(metadata.id, source);

    return this.createRuntimeSource(source);
  }

  private parseMetadata(metadata: ProjectAudioSource): ProjectAudioSource {
    const result = ProjectAudioSourceSchema.safeParse(metadata);
    if (!result.success) {
      throw new AudioSourceRegistryError({
        code: 'INVALID_SOURCE_METADATA',
        message: '오디오 Source metadata가 유효하지 않습니다.',
        details: { issues: result.error.issues },
      });
    }

    return result.data;
  }

  private assertValidBlob(blob: unknown): asserts blob is Blob {
    if (typeof globalThis.Blob === 'function' && blob instanceof globalThis.Blob) {
      return;
    }

    throw new AudioSourceRegistryError({
      code: 'INVALID_SOURCE_BLOB',
      message: '오디오 Source의 원본이 Blob 형식이 아닙니다.',
    });
  }

  private createObjectUrl(blob: Blob, sourceId: string): string {
    let objectUrl: string;

    try {
      objectUrl = this.objectUrlAdapter.createObjectUrl(blob);
    } catch (cause) {
      throw new AudioSourceRegistryError({
        code: 'OBJECT_URL_CREATION_FAILED',
        message: `오디오 Source의 Object URL을 만들지 못했습니다: ${sourceId}`,
        details: { sourceId },
        cause,
      });
    }

    if (typeof objectUrl !== 'string' || objectUrl.trim().length === 0) {
      throw new AudioSourceRegistryError({
        code: 'OBJECT_URL_CREATION_FAILED',
        message: `오디오 Source의 Object URL이 비어 있습니다: ${sourceId}`,
        details: { sourceId },
      });
    }

    return objectUrl;
  }

  private createRuntimeSource(source: StoredAudioSource): RuntimeAudioSource {
    return {
      metadata: { ...source.metadata },
      objectUrl: source.objectUrl,
      isCommitted: source.isCommitted,
      regionIds: [...source.regionIds],
    };
  }

  private getRequiredSource(sourceId: string): StoredAudioSource {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new AudioSourceRegistryError({
        code: 'SOURCE_NOT_FOUND',
        message: `등록된 오디오 Source를 찾을 수 없습니다: ${sourceId}`,
        details: { sourceId },
      });
    }

    return source;
  }

  private assertValidRegionId(regionId: string): void {
    if (RegionIdSchema.safeParse(regionId).success) {
      return;
    }

    throw new AudioSourceRegistryError({
      code: 'INVALID_REGION_ID',
      message: `Region ID 형식이 유효하지 않습니다: ${regionId}`,
      details: { regionId },
    });
  }

  private removeSourceAndRevoke(sourceId: string, source: StoredAudioSource): void {
    try {
      this.objectUrlAdapter.revokeObjectUrl(source.objectUrl);
    } catch (cause) {
      throw new AudioSourceRegistryError({
        code: 'OBJECT_URL_REVOCATION_FAILED',
        message: `오디오 Source의 Object URL을 해제하지 못했습니다: ${sourceId}`,
        details: { objectUrl: source.objectUrl, sourceId },
        cause,
      });
    }

    this.sources.delete(sourceId);
  }
}
