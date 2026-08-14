import { describe, expect, it } from 'vitest';
import type { IAudioSourceResolver } from '../audio-source-registry/i-audio-source-registry';
import { MediaSourceQuery } from './media-source-query';

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';
const DERIVED_SOURCE_ID = '22222222-2222-4222-8222-222222222222';

describe('MediaSourceQuery', () => {
  it('Source 관리 metadata와 실제 브라우저 codec 지원 상태를 함께 반환한다', () => {
    const metadata = {
      bwfMetadata: null,
      byteLength: 44,
      derivation: null,
      durationSeconds: 1,
      fileName: 'voice.wav',
      id: SOURCE_ID,
      mimeType: 'audio/wav',
      tags: ['dialogue'],
      transientPositionsSeconds: [0.25],
    };
    const resolver: IAudioSourceResolver = {
      listCommittedMetadata: () => [metadata],
      resolve: () => ({
        isCommitted: true,
        loopSlotIds: [],
        metadata,
        objectUrl: 'blob:source',
        regionIds: ['22222222-2222-4222-8222-222222222222'],
      }),
    };
    const query = new MediaSourceQuery({
      audioSourceResolver: resolver,
      canPlayType: mimeType => (mimeType === 'audio/wav' ? 'probably' : ''),
    });

    expect(query.readSources()).toEqual([
      expect.objectContaining({
        codec: 'wav',
        codecSupport: 'probably',
        id: SOURCE_ID,
        regionIds: ['22222222-2222-4222-8222-222222222222'],
        tags: ['dialogue'],
      }),
    ]);
  });

  it('파생 Source가 참조하는 원본 Source를 사용 중으로 분류한다', () => {
    const originalMetadata = {
      bwfMetadata: null,
      byteLength: 44,
      derivation: null,
      durationSeconds: 1,
      fileName: 'original.wav',
      id: SOURCE_ID,
      mimeType: 'audio/wav',
      tags: [],
      transientPositionsSeconds: [],
    };
    const derivedMetadata = {
      ...originalMetadata,
      derivation: { operation: 'bounce' as const, parameters: {}, sourceId: SOURCE_ID },
      fileName: 'bounce.wav',
      id: DERIVED_SOURCE_ID,
    };
    const resolver: IAudioSourceResolver = {
      listCommittedMetadata: () => [originalMetadata, derivedMetadata],
      resolve: sourceId => ({
        isCommitted: true,
        loopSlotIds: [],
        metadata: sourceId === SOURCE_ID ? originalMetadata : derivedMetadata,
        objectUrl: `blob:${sourceId}`,
        regionIds: sourceId === DERIVED_SOURCE_ID ? ['33333333-3333-4333-8333-333333333333'] : [],
      }),
    };
    const query = new MediaSourceQuery({ audioSourceResolver: resolver, canPlayType: () => 'probably' });

    expect(query.readSources().find(source => source.id === SOURCE_ID)?.isInUse).toBe(true);
  });
});
