import { describe, expect, it } from 'vitest';
import { AudioEngineErrorCode, UnsupportedAudioFeatureError } from './errors';

describe('UnsupportedAudioFeatureError', () => {
  it('미지원 기능과 호출 메서드를 구조화된 상세 정보로 제공한다', () => {
    const error = new UnsupportedAudioFeatureError({
      feature: 'metering',
      method: 'getMeterData',
    });

    expect(error).toMatchObject({
      code: AudioEngineErrorCode.UNSUPPORTED_FEATURE,
      details: {
        feature: 'metering',
        method: 'getMeterData',
      },
      name: 'UnsupportedAudioFeatureError',
    });
  });
});
