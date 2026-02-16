import { describe, it, expect, vi } from 'vitest';
import { createSessionStore } from '../session/session';
import { PlaybackController } from './playback-controller';
import { TrackController } from './track-controller';
import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { AppController } from '.';

describe('AppController', () => {
  it('should initialize sub-controllers', () => {
    // Arrange
    const sessionStore = createSessionStore();
    const audioEngine: IAudioEngine = {
      play: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      setVolume: vi.fn(),
      seekTo: vi.fn(),
      loadTrack: vi.fn(),
    };

    // Act
    const appController = new AppController(sessionStore, audioEngine);

    // Assert
    expect(appController.playback).toBeInstanceOf(PlaybackController);
    expect(appController.track).toBeInstanceOf(TrackController);
  });
});
