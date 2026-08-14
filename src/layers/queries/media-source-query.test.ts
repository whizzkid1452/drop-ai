import { describe, expect, it } from 'vitest';
import type { IAudioSourceResolver } from '../audio-source-registry/i-audio-source-registry';
import { MediaSourceQuery } from './media-source-query';

const SOURCE_ID = '11111111-1111-4111-8111-111111111111';

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
});
