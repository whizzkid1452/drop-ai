import { describe, expect, it, vi } from 'vitest';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { createSessionStore } from '../session/session';
import { MixerController } from './mixer-controller';

const INITIAL_PROJECT_METADATA = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Mixer 테스트',
  revision: 0,
};

function createTestContext() {
  const audioEngine = new MockAudioEngine();
  const sessionStore = createSessionStore({ initialProjectMetadata: INITIAL_PROJECT_METADATA });
  const controller = new MixerController({ audioEngine, sessionStore });
  return { audioEngine, controller, sessionStore };
}

describe('MixerController', () => {
  it('AudioEngine 성공 뒤 Session Master Volume을 변경한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    const setMasterVolume = vi.spyOn(audioEngine, 'setMasterVolume');

    controller.setMasterVolume(0.5);

    expect(setMasterVolume).toHaveBeenCalledWith(0.5);
    expect(audioEngine.getMasterVolume()).toBe(0.5);
    expect(sessionStore.getState().masterVolume).toBe(0.5);
  });

  it('AudioEngine 변경이 실패하면 Session 값을 유지한다', () => {
    const { audioEngine, controller, sessionStore } = createTestContext();
    vi.spyOn(audioEngine, 'setMasterVolume').mockImplementation(() => {
      throw new Error('master volume failed');
    });

    expect(() => controller.setMasterVolume(0.5)).toThrow('master volume failed');
    expect(sessionStore.getState().masterVolume).toBe(1);
  });
});
