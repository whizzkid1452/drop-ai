import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaybackController } from './playback-controller';
import { createSessionStore, type SessionStore } from '../session/session';
import type { IAudioEngine } from '../audio-engine/i-audio-engine';

describe('PlaybackController', () => {
  let sessionStore: SessionStore;
  let audioEngine: IAudioEngine;
  let playbackController: PlaybackController;

  beforeEach(() => {
    sessionStore = createSessionStore();
    audioEngine = {
      play: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      setVolume: vi.fn(),
      seekTo: vi.fn(),
      getCurrentTime: vi.fn(),
      loadFile: vi.fn(),
      setTrackVolume: vi.fn(),
      setTrackMute: vi.fn(),
      setTrackSolo: vi.fn(),
      removeTrack: vi.fn(),
      createTrack: vi.fn(),
      addRegion: vi.fn(),
      removeRegion: vi.fn(),
      moveRegion: vi.fn(),
      setLoop: vi.fn(),
      setLoopPoints: vi.fn(),
      setBpm: vi.fn(),
      getDebugInfo: vi.fn(),
      setTrackPan: vi.fn(),
      exportSession: vi.fn(),
    };
    playbackController = new PlaybackController(sessionStore, audioEngine);
  });

  describe('handlePlay', () => {
    it('should call audioEngine.play and set session state to playing', async () => {
      // Act
      await playbackController.handlePlay();

      // Assert
      expect(audioEngine.play).toHaveBeenCalledTimes(1);
      expect(sessionStore.getState().isPlaying).toBe(true);
    });
  });

  describe('handleStop', () => {
    it('should call audioEngine.stop and set session state to not playing', () => {
      // Arrange
      sessionStore.setState({ isPlaying: true });

      // Act
      playbackController.handleStop();

      // Assert
      expect(audioEngine.stop).toHaveBeenCalledTimes(1);
      expect(sessionStore.getState().isPlaying).toBe(false);
    });
  });

  describe('handlePause', () => {
    it('should call audioEngine.pause and set session state to not playing', () => {
      // Arrange
      sessionStore.setState({ isPlaying: true });

      // Act
      playbackController.handlePause();

      // Assert
      expect(audioEngine.pause).toHaveBeenCalledTimes(1);
      expect(sessionStore.getState().isPlaying).toBe(false);
    });
  });
});
