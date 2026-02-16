import { describe, it, expect, vi } from 'vitest';
import { AudioEngine } from './audio-engine';

describe('AudioEngine', () => {
  // Current implementation is just logging, so we verify methods don't throw and potentially log
  it('should play', async () => {
    const engine = new AudioEngine();
    const spy = vi.spyOn(console, 'log');
    await expect(engine.play()).resolves.not.toThrow();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Play'));
  });

  it('should stop', () => {
    const engine = new AudioEngine();
    const spy = vi.spyOn(console, 'log');
    engine.stop();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Stop'));
  });

  it('should pause', () => {
    const engine = new AudioEngine();
    const spy = vi.spyOn(console, 'log');
    engine.pause();
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Pause'));
  });

  it('should set volume', () => {
    const engine = new AudioEngine();
    const spy = vi.spyOn(console, 'log');
    engine.setVolume(0.5);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Set Volume: 0.5')
    );
  });

  it('should seek to time', () => {
    const engine = new AudioEngine();
    const spy = vi.spyOn(console, 'log');
    engine.seekTo(10);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Seek to: 10'));
  });

  it('should load track', async () => {
    const engine = new AudioEngine();
    const spy = vi.spyOn(console, 'log');
    await expect(
      engine.loadTrack('http://example.com', 'track-1')
    ).resolves.not.toThrow();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Loading track track-1 from http://example.com')
    );
  });
});
