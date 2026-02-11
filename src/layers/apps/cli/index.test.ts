import { describe, it, expect, vi } from 'vitest';
import { createCliCommands } from './index';
import { AppController } from '../../controllers/app-controller';

describe('CLI Command Logic', () => {
  const mockController = {
    playback: {
      handlePlay: vi.fn(),
      handleStop: vi.fn(),
      handlePause: vi.fn(),
    },
    track: {
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
    },
  } as unknown as AppController;

  const mockState = { isPlaying: false, trackCount: 0, currentTime: 0, tempo: 120 };

  it('should call handlePlay when play command is executed', async () => {
    const commands = createCliCommands(mockController, mockState);
    const result = await commands['play'].fn();
    expect(mockController.playback.handlePlay).toHaveBeenCalled();
    expect(result).toContain('started');
  });

  it('should reflect current state in status command', () => {
    const playingState = { isPlaying: true, trackCount: 3, currentTime: 5.5, tempo: 140 };
    const commands = createCliCommands(mockController, playingState);
    const result = commands['status'].fn() as string;
    expect(result).toContain('Playing');
    expect(result).toContain('3');
  });
});
