import { describe, expect, it } from 'vitest';
import { AudioCommandType } from '../types/audioCommand.schema';
import { assertAudioCommandCapability, UnsupportedAudioCommandError } from './audio-command-capability-guard';
import {
  AudioRuntimeBlocker,
  AudioRuntimeFeature,
  CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT,
  PERMISSIVE_AUDIO_RUNTIME_ENVIRONMENT,
  resolveAudioRuntimeCapabilities,
} from './audio-runtime-capabilities';

describe('assertAudioCommandCapability', () => {
  it('사용 가능한 기능 명령은 통과시킨다', () => {
    const capabilities = resolveAudioRuntimeCapabilities(PERMISSIVE_AUDIO_RUNTIME_ENVIRONMENT);

    expect(() =>
      assertAudioCommandCapability({
        capabilities,
        command: { type: AudioCommandType.PLAY },
      })
    ).not.toThrow();
  });

  it('저장처럼 runtime 기능이 없는 명령은 통과시킨다', () => {
    const capabilities = resolveAudioRuntimeCapabilities({
      ...PERMISSIVE_AUDIO_RUNTIME_ENVIRONMENT,
      hasGetUserMedia: false,
    });

    expect(() =>
      assertAudioCommandCapability({
        capabilities,
        command: { type: AudioCommandType.SAVE_PROJECT },
      })
    ).not.toThrow();
  });

  it('미구현 기능 명령을 실행 전에 거부한다', () => {
    const capabilities = resolveAudioRuntimeCapabilities(PERMISSIVE_AUDIO_RUNTIME_ENVIRONMENT, {
      ...CURRENT_AUDIO_RUNTIME_FEATURE_SUPPORT,
      [AudioRuntimeFeature.MIDI]: false,
    });

    try {
      assertAudioCommandCapability({
        capabilities,
        command: { trackId: '11111111-1111-4111-8111-111111111111', type: AudioCommandType.ADD_MIDI_TRACK },
      });
      throw new Error('미지원 MIDI 명령을 거부하지 않았습니다.');
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedAudioCommandError);
      expect(error).toMatchObject({
        code: 'UNSUPPORTED_AUDIO_COMMAND',
        commandType: AudioCommandType.ADD_MIDI_TRACK,
        feature: AudioRuntimeFeature.MIDI,
        status: 'unsupported',
      });
    }
  });

  it('환경 차단 기능 명령을 실행 전에 거부한다', () => {
    const capabilities = resolveAudioRuntimeCapabilities({
      ...PERMISSIVE_AUDIO_RUNTIME_ENVIRONMENT,
      hasGetUserMedia: false,
    });

    try {
      assertAudioCommandCapability({
        capabilities,
        command: { deviceId: null, type: AudioCommandType.SET_AUDIO_INPUT_DEVICE },
      });
      throw new Error('환경 차단 명령을 거부하지 않았습니다.');
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedAudioCommandError);
      expect(error).toMatchObject({
        blockers: [AudioRuntimeBlocker.GET_USER_MEDIA_API_UNAVAILABLE],
        commandType: AudioCommandType.SET_AUDIO_INPUT_DEVICE,
        feature: AudioRuntimeFeature.LIVE_INPUT,
        status: 'blocked',
      });
    }
  });
});
