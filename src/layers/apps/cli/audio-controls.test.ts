import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCliCommands } from './index';
import { CommandsType } from './constants';
import type { AppController } from '@/layers/controllers';

describe('CLI Audio Controls', () => {
  let mockController: AppController;
  let commands: ReturnType<typeof createCliCommands>;

  beforeEach(() => {
    mockController = {
      playback: {
        handlePlay: vi.fn(),
        handleStop: vi.fn(),
        handlePause: vi.fn(),
      },
      track: {
        addTrack: vi.fn(),
        removeTrack: vi.fn(),
        createTrackFromFile: vi.fn(),
        updateTrackSourceFromFile: vi.fn(),
        setTrackVolume: vi.fn(),
        setTrackMute: vi.fn(),
        setTrackSolo: vi.fn(),
      },
      session: {} as any,
    } as unknown as AppController;

    commands = createCliCommands({
      controller: mockController,
    });
  });

  describe('volume command', () => {
    it('should set track volume correctly', async () => {
      const result = await commands[CommandsType.volume].fn('track-1', '0.5');
      expect(mockController.track.setTrackVolume).toHaveBeenCalledWith(
        'track-1',
        0.5
      );
      expect(result).toBe('Set volume of track track-1 to 0.5');
    });

    it('should validate volume range', async () => {
      const result = await commands[CommandsType.volume].fn('track-1', '1.5');
      expect(mockController.track.setTrackVolume).not.toHaveBeenCalled();
      expect(result).toContain(
        'Error: Volume must be a number between 0.0 and 1.0'
      );
    });

    it('should validate inputs', async () => {
      const result = await commands[CommandsType.volume].fn('track-1');
      expect(mockController.track.setTrackVolume).not.toHaveBeenCalled();
      expect(result).toContain('Error: Track ID and volume value required');
    });
  });

  describe('mute command', () => {
    it('should mute track', async () => {
      const result = await commands[CommandsType.mute].fn('track-1', 'on');
      expect(mockController.track.setTrackMute).toHaveBeenCalledWith(
        'track-1',
        true
      );
      expect(result).toBe('Track track-1 muted.');
    });

    it('should unmute track', async () => {
      const result = await commands[CommandsType.mute].fn('track-1', 'off');
      expect(mockController.track.setTrackMute).toHaveBeenCalledWith(
        'track-1',
        false
      );
      expect(result).toBe('Track track-1 unmuted.');
    });

    it('should validate state input', async () => {
      const result = await commands[CommandsType.mute].fn('track-1', 'invalid');
      expect(mockController.track.setTrackMute).not.toHaveBeenCalled();
      expect(result).toContain('Error: State must be "on" or "off"');
    });
  });

  describe('solo command', () => {
    it('should solo track', async () => {
      const result = await commands[CommandsType.solo].fn('track-1', 'on');
      expect(mockController.track.setTrackSolo).toHaveBeenCalledWith(
        'track-1',
        true
      );
      expect(result).toBe('Track track-1 soloed.');
    });

    it('should unsolo track', async () => {
      const result = await commands[CommandsType.solo].fn('track-1', 'off');
      expect(mockController.track.setTrackSolo).toHaveBeenCalledWith(
        'track-1',
        false
      );
      expect(result).toBe('Track track-1 unsoloed.');
    });

    it('should validate state input', async () => {
      const result = await commands[CommandsType.solo].fn('track-1', 'invalid');
      expect(mockController.track.setTrackSolo).not.toHaveBeenCalled();
      expect(result).toContain('Error: State must be "on" or "off"');
    });
  });
});
