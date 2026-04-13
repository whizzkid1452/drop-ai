import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WebDAW } from './WebDAW';
import { LayerProvider } from '../context/LayerContext';
import { AudioEngine } from '@/layers/audio-engine/audio-engine';

// Mock matchMedia for xterm
window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

// Mock CliTerminal to avoid xterm rendering entirely
vi.mock('@/layers/apps/cli/ui/CliTerminal', () => ({
  CliTerminal: () => <div data-testid="cli-terminal-mock">CLI Terminal</div>,
}));

// Mock AudioEngine to avoid real audio context
// And also mock session/controllers if possible, but LayerProvider sets them up.
// We can use the real LayerProvider but mock AudioEngine inner workings.

vi.mock('@/layers/audio-engine/audio-engine', () => {
  return {
    AudioEngine: vi.fn().mockImplementation(function () {
      return {
        createTrack: vi.fn().mockResolvedValue({ id: 'track-1' }),
        removeTrack: vi.fn(),
        setTrackVolume: vi.fn(),
        setTrackPan: vi.fn(),
        setTrackMute: vi.fn(),
        setTrackSolo: vi.fn(),
        handlePlay: vi.fn(),
        handleStop: vi.fn(),
        handlePause: vi.fn(),
        handleBpm: vi.fn(),
        handleLoop: vi.fn(),
        handleMasterVolume: vi.fn(),
        getCurrentTime: vi.fn().mockReturnValue(0),
      };
    }),
  };
});

// Mock requestAnimationFrame
global.requestAnimationFrame = cb => setTimeout(cb, 16);
global.cancelAnimationFrame = id => clearTimeout(id);

const renderWithProvider = (ui: React.ReactElement) => {
  const engine = new AudioEngine();
  return render(<LayerProvider engine={engine}>{ui}</LayerProvider>);
};

describe('WebDAW Integration', () => {
  it('renders Transport and TrackList', () => {
    renderWithProvider(<WebDAW />);
    expect(screen.getByText('Play')).toBeDefined();
    expect(screen.getByText('Stop')).toBeDefined();
    expect(screen.getByText(/Tracks \(\d+\)/)).toBeDefined();
  });

  it('adds a track and displays it', async () => {
    renderWithProvider(<WebDAW />);

    const addBtn = screen.getByText('+ Add Track');
    await act(async () => {
      fireEvent.click(addBtn);
    });

    // Expect a track to appear
    const trackItem = await screen.findByTestId('track-item');
    expect(trackItem).toBeDefined();
    expect(trackItem.textContent).toContain('Track');
    // expect(screen.getByText(/Vol/)).toBeDefined();
  });

  // More interaction tests could be added here
});
