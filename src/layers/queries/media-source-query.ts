import type { IAudioSourceResolver } from '../audio-source-registry/i-audio-source-registry';
import type { ProjectAudioSourceV16 } from '../shared/types/project-document.schema';
import {
  detectAudioCodec,
  readBrowserAudioCodecSupport,
  type AudioCodec,
} from '../shared/utils/audio/audio-source-file-metadata';

export interface MediaSourceState extends ProjectAudioSourceV16 {
  readonly codec: AudioCodec;
  readonly codecSupport: CanPlayTypeResult;
  readonly isInUse: boolean;
  readonly loopSlotIds: readonly string[];
  readonly objectUrl: string;
  readonly regionIds: readonly string[];
}

export interface IMediaSourceQuery {
  readSources(): readonly MediaSourceState[];
}

interface MediaSourceQueryOptions {
  readonly audioSourceResolver: IAudioSourceResolver;
  readonly canPlayType: (mimeType: string) => CanPlayTypeResult;
}

export class MediaSourceQuery implements IMediaSourceQuery {
  readonly #audioSourceResolver: IAudioSourceResolver;
  readonly #canPlayType: (mimeType: string) => CanPlayTypeResult;

  constructor({ audioSourceResolver, canPlayType }: MediaSourceQueryOptions) {
    this.#audioSourceResolver = audioSourceResolver;
    this.#canPlayType = canPlayType;
  }

  readSources(): readonly MediaSourceState[] {
    const supportByCodec = new Map(
      readBrowserAudioCodecSupport({ canPlayType: this.#canPlayType }).map(support => [support.codec, support])
    );
    return this.#audioSourceResolver.listCommittedMetadata().flatMap(metadata => {
      const runtime = this.#audioSourceResolver.resolve(metadata.id);
      if (!runtime) {
        return [];
      }
      const codec = detectAudioCodec({
        bytes: new Uint8Array(),
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
      });
      const managedMetadata = metadata as Partial<ProjectAudioSourceV16>;
      const regionIds = [...runtime.regionIds];
      const loopSlotIds = [...(runtime.loopSlotIds ?? [])];
      return [
        {
          ...metadata,
          bwfMetadata: managedMetadata.bwfMetadata ? { ...managedMetadata.bwfMetadata } : null,
          codec,
          codecSupport: codec === 'unknown' ? '' : (supportByCodec.get(codec)?.supportLevel ?? ''),
          derivation: managedMetadata.derivation
            ? { ...managedMetadata.derivation, parameters: { ...managedMetadata.derivation.parameters } }
            : null,
          isInUse: regionIds.length > 0 || loopSlotIds.length > 0,
          loopSlotIds,
          objectUrl: runtime.objectUrl,
          regionIds,
          tags: managedMetadata.tags ? [...managedMetadata.tags] : [],
          transientPositionsSeconds: managedMetadata.transientPositionsSeconds
            ? [...managedMetadata.transientPositionsSeconds]
            : [],
        },
      ];
    });
  }
}

export function createBrowserCanPlayType(): (mimeType: string) => CanPlayTypeResult {
  const audio = globalThis.document?.createElement('audio');
  return mimeType => audio?.canPlayType(mimeType) ?? '';
}
