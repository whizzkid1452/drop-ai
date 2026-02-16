import { describe, it, expect, vi } from 'vitest';
import { createCliCommands } from './index';
import { AppController } from '../../controllers';

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
          tracks: new Map([
            [
              'track-1',
              {
                id: 'track-1',
                name: 'Test Track',
                duration: 120,
                volume: 1.0,
                isMuted: false,
                isSoloed: false,
                src: null,
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
    expect(result).toContain('1');
    expect(result).toContain('Test Track');
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
                duration: 10,
                volume: 1.0,
                isMuted: false,
                isSoloed: false,
                src: null,
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
                duration: 10,
                volume: 1.0,
                isMuted: false,
                isSoloed: false,
                src: null,
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
    // If not normalized, it might be counted as 6 chars * 2 width = 12 width -> 8 spaces padding.
    // 8 spaces padding + 2 visual width (if rendered as combined) = 10 visual width. (Short by 10)
    // We expect normalization to NFC, so width 4, padding 16.
    expect(result).toContain('한글                ');
  });
});
