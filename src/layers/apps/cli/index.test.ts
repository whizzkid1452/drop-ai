import { describe, it, expect, vi } from 'vitest';
import { createCliCommands } from './index';
import { AppController } from '../../controllers';
import type { CliState, Track } from './types';

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

  const mockState: CliState = { 
    isPlaying: false, 
    tracks: new Map<string, Track>(), 
    currentTime: 0, 
    tempo: 120 
  };

  it('should call handlePlay when play command is executed', async () => {
    const commands = createCliCommands(mockController, mockState);
    const result = await commands['play'].fn();
    expect(mockController.playback.handlePlay).toHaveBeenCalled();
    expect(result).toContain('started');
  });

  it('should reflect current state in status command', () => {
    const tracks = new Map<string, Track>();
    tracks.set('t1', { id: 't1', regions: [] } as Track);
    tracks.set('t2', { id: 't2', regions: [] } as Track);
    tracks.set('t3', { id: 't3', regions: [] } as Track);

    const playingState: CliState = { 
      isPlaying: true, 
      tracks, 
      currentTime: 5.5, 
      tempo: 140 
    };
    const commands = createCliCommands(mockController, playingState);
    const result = commands['status'].fn() as string; // fn returns string | Promise<string>, status is sync so string
    
    expect(result).toContain('Playing');
    expect(result).toContain('3'); // Track count
  });
});
