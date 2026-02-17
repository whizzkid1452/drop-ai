import { describe, it, expect, vi } from 'vitest';
import { createCliCommands } from './index';
import { AppController } from '../../controllers';

describe('CLI Command Logic', () => {
  const mockController = {
    playback: {
      handlePlay: vi.fn(),
      handleStop: vi.fn(),
      handlePause: vi.fn(),
      handleSeek: vi.fn(),
      handleLoop: vi.fn(),
      handleBpm: vi.fn(),
      handleMasterVolume: vi.fn(),
    },
    track: {
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
    },
    session: {
      getState: () => ({
        isPlaying: false,
        tracks: new Map(),
      }),
    },
  } as unknown as AppController;

  it('should call handlePlay when play command is executed', async () => {
    const commands = createCliCommands({
      controller: mockController,
    });
    const result = await commands['play'].fn();
    expect(mockController.playback.handlePlay).toHaveBeenCalled();
    expect(result).toContain('started');
  });

  it('should reflect current state in status command', () => {
    // Override session mock for this test
    const mockSessionController = {
      ...mockController,
      session: {
        getState: () => ({
          isPlaying: true,
          bpm: 120,
          isLooping: true,
          loopStart: 0,
          loopEnd: 4,
          tracks: new Map([
            [
              'track-1',
              {
                id: 'track-1',
                name: 'Test Track',
                volume: 1.0,
                isMuted: false,
                isSoloed: false,
                regions: [
                  {
                    id: 'region-1',
                    trackId: 'track-1',
                    src: 'blob:url',
                    startTime: 0,
                    duration: 120,
                    offset: 0,
                  },
                ],
              },
            ],
          ]),
        }),
      },
    } as unknown as AppController;

    const commands = createCliCommands({
      controller: mockSessionController,
    });
    const result = commands['status'].fn() as string;
    expect(result).toContain('Playing');
    expect(result).toContain('BPM: 120');
    expect(result).toContain('Loop: ON (0s - 4s)');
    expect(result).toContain('1'); // Track count
    expect(result).toContain('Test Track');
    // Regions
    expect(result).toContain('Regions:');
    expect(result).toContain('region-1');
    expect(result).toContain('120.0s');
  });

  it('should align columns correctly with Korean characters', () => {
    const mockSessionController = {
      ...mockController,
      session: {
        getState: () => ({
          isPlaying: false,
          tracks: new Map([
            [
              'track-1',
              {
                id: 'track-1',
                name: '안녕하세요', // Width 10 (5 chars * 2)
                volume: 1.0,
                isMuted: false,
                isSoloed: false,
                regions: [],
              },
            ],
          ]),
        }),
      },
    } as unknown as AppController;

    const commands = createCliCommands({
      controller: mockSessionController,
    });
    const result = commands['status'].fn() as string;

    // Check if padding is correct.
    // '안녕하세요' is 10 visual width. target is 20. padding should be 10 spaces.
    // We can check if the line contains the name followed by spaces
    expect(result).toContain('안녕하세요          ');
  });

  it('should normalize NFD strings to NFC for correct alignment', () => {
    // Construct NFD string: 'ᄒ' (U+1112) + 'ᅡ' (U+1161) + 'ᆫ' (U+11AB) = '한'
    const nfdName = '\u1112\u1161\u11AB\u1100\u1173\u11AF'; // "한글" in NFD

    const mockSessionController = {
      ...mockController,
      session: {
        getState: () => ({
          isPlaying: false,
          tracks: new Map([
            [
              'track-1',
              {
                id: 'track-1',
                name: nfdName,
                volume: 1.0,
                isMuted: false,
                isSoloed: false,
                regions: [],
              },
            ],
          ]),
        }),
      },
    } as unknown as AppController;

    const commands = createCliCommands({
      controller: mockSessionController,
    });
    const result = commands['status'].fn() as string;

    // "한글" is width 4. Padding 16 spaces.
    expect(result).toContain('한글                ');
  });

  it('should call moveRegion when region move command is executed', async () => {
    // Override moveRegion mock
    const mockTrackController = {
      ...mockController.track,
      moveRegion: vi.fn(),
    };

    const mockControllerWithMove = {
      ...mockController,
      track: mockTrackController,
    } as unknown as AppController;

    const commands = createCliCommands({
      controller: mockControllerWithMove,
    });

    // region move <trackId> <regionId> <startTime>
    const result = await commands['region'].fn(
      'move',
      'track-1',
      'region-1',
      '5.5'
    );

    expect(mockTrackController.moveRegion).toHaveBeenCalledWith(
      'track-1',
      'region-1',
      5.5
    );
    expect(result).toContain('Moved region region-1 to 5.5s');
  });

  it('should call removeRegion when region remove command is executed', async () => {
    // Override removeRegion mock
    const mockTrackController = {
      ...mockController.track,
      removeRegion: vi.fn(),
    };

    const mockControllerWithRemove = {
      ...mockController,
      track: mockTrackController,
    } as unknown as AppController;

    const commands = createCliCommands({
      controller: mockControllerWithRemove,
    });

    // region remove <trackId> <regionId>
    const result = await commands['region'].fn('remove', 'track-1', 'region-1');

    expect(mockTrackController.removeRegion).toHaveBeenCalledWith(
      'track-1',
      'region-1'
    );
    expect(result).toContain('Removed region region-1');
  });

  it('should return error for invalid region subcommand', async () => {
    const commands = createCliCommands({
      controller: mockController,
    });
    const result = await commands['region'].fn(
      'invalid',
      'track-1',
      'region-1'
    );
    expect(result).toContain('Error: Unknown subcommand');
  });

  it('should call handleSeek when seek command is executed', async () => {
    const commands = createCliCommands({
      controller: mockController,
    });
    const result = await commands['seek'].fn('10.5');
    expect(mockController.playback.handleSeek).toHaveBeenCalledWith(10.5);
    expect(result).toContain('Seek to 10.5s');
  });

  it('should return error for invalid seek time', async () => {
    const commands = createCliCommands({
      controller: mockController,
    });
    const result = await commands['seek'].fn('invalid');
    expect(result).toContain('Error: Time must be a valid positive number');
  });

  it('should call handlePause when pause command is executed', async () => {
    const commands = createCliCommands({
      controller: mockController,
    });
    const result = await commands['pause'].fn();
    expect(mockController.playback.handlePause).toHaveBeenCalled();
    expect(result).toContain('paused');
  });

  it('should call handleLoop when loop command is executed', async () => {
    const commands = createCliCommands({
      controller: mockController,
    });

    // Loop On
    const resultOn = await commands['loop'].fn('1', '4');
    expect(mockController.playback.handleLoop).toHaveBeenCalledWith(1, 4, true);
    expect(resultOn).toContain('Loop set from 1s to 4s');

    // Loop Off
    const resultOff = await commands['loop'].fn('off');
    expect(mockController.playback.handleLoop).toHaveBeenCalledWith(
      0,
      0,
      false
    );
    expect(resultOff).toContain('Loop turned off');
  });

  it('should call handleBpm when bpm command is executed', async () => {
    const commands = createCliCommands({
      controller: mockController,
    });
    const result = await commands['bpm'].fn('120');
    expect(mockController.playback.handleBpm).toHaveBeenCalledWith(120);
    expect(result).toContain('BPM set to 120');
  });

  it('should call handleMasterVolume when master command is executed', async () => {
    const commands = createCliCommands({
      controller: mockController,
    });
    const result = await commands['master'].fn('0.8');
    expect(mockController.playback.handleMasterVolume).toHaveBeenCalledWith(
      0.8
    );
    expect(result).toContain('Master volume set to 0.8');
  });
});
