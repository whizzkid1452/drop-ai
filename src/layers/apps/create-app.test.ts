import { describe, expect, it } from 'vitest';
import { CommandExecutor } from '../commands/command-executor';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { PlaybackClockQuery } from '../queries/playback-clock-query';
import { AudioCommandType } from '../shared/types/audioCommand.schema';
import { createApp, createCliTestApp } from './create-app';

describe('createApp', () => {
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
});
