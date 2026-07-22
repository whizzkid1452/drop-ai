import { describe, expect, it } from 'vitest';
import { CommandExecutor } from '../commands/command-executor';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { PlaybackClockQuery } from '../queries/playback-clock-query';
import { AudioCommandType } from '../shared/types/audioCommand.schema';
import { createApp, createCliTestApp } from './create-app';

describe('createApp', () => {
  it('새 프로젝트 metadata를 UUID와 revision 0으로 만든다', () => {
    const app = createApp({ audioEngine: new MockAudioEngine() });

    expect(app.session.getState().project).toMatchObject({
      name: '새 프로젝트',
      revision: 0,
    });
    expect(app.session.getState().project.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('주입한 프로젝트 metadata로 Session을 조립한다', () => {
    const initialProjectMetadata = {
      id: '11111111-1111-4111-8111-111111111111',
      name: '불러온 프로젝트',
      revision: 4,
    };

    const app = createApp({ audioEngine: new MockAudioEngine(), initialProjectMetadata });

    expect(app.session.getState().project).toEqual(initialProjectMetadata);
  });

  it('하나의 CommandExecutor를 조립한다', () => {
    const app = createApp({ audioEngine: new MockAudioEngine() });

    expect(app.commandExecutor).toBeInstanceOf(CommandExecutor);
  });

  it('Controller를 노출하지 않고 읽기 전용 PlaybackClock을 조립한다', () => {
    const audioEngine = new MockAudioEngine();
    audioEngine.setTime(7.5);

    const app = createApp({ audioEngine });

    expect(app.playbackClock).toBeInstanceOf(PlaybackClockQuery);
    expect(app.playbackClock.getCurrentTime()).toBe(7.5);
    expect('controller' in app).toBe(false);
  });

  it('CLI 테스트용 AudioEngine도 Composition Root에서 조립한다', async () => {
    const app = createCliTestApp();

    await app.commandExecutor.execute({ type: AudioCommandType.PLAY });

    expect(app.session.getState().isPlaying).toBe(true);
  });

  it('브라우저 오디오 환경을 읽기 전용 capability로 조립한다', () => {
    const app = createApp({
      audioEngine: new MockAudioEngine(),
      audioRuntimeEnvironment: {
        crossOriginIsolated: false,
        hasAudioWorklet: true,
        hasSharedArrayBuffer: false,
        hasWebAssembly: true,
        isSecureContext: true,
      },
    });

    expect(app.audioRuntimeCapabilities).toMatchObject({
      meetsAudioWorkletPreconditions: true,
      meetsSharedMemoryPreconditions: false,
      meetsWasmPreconditions: true,
    });
  });
});
