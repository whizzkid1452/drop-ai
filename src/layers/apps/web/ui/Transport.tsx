import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useController, useSession } from '../../context/LayerContext';
import { DebouncedInput } from '@/components/common/DebouncedInput';

export const Transport = () => {
  const controller = useController();

  const { isPlaying, bpm, isLooping, loopStart, loopEnd } = useSession(
    useShallow(state => ({
      isPlaying: state.isPlaying,
      bpm: state.bpm,
      isLooping: state.isLooping,
      loopStart: state.loopStart,
      loopEnd: state.loopEnd,
    }))
  );

  const [currentTime, setCurrentTime] = useState('0.00');

  // Update time display (polling for now, ideally requestAnimationFrame)
  useEffect(() => {
    let animationFrameId: number;
    const updateTime = () => {
      const time = controller.playback.getCurrentTime();
      setCurrentTime(time.toFixed(2));
      animationFrameId = requestAnimationFrame(updateTime);
    };
    updateTime();
    return () => cancelAnimationFrame(animationFrameId);
  }, [controller]);

  const handleBpmChange = (val: string | number) => {
    const num = parseFloat(val.toString());
    if (!isNaN(num) && num > 0) controller.playback.handleBpm(num);
  };

  const handleLoopStartChange = (val: string | number) => {
    const start = parseFloat(val.toString());
    if (!isNaN(start) && start >= 0) {
      if (start < loopEnd && isLooping) {
        controller.playback.handleLoop(start, loopEnd, true);
      }
    }
  };

  const handleLoopEndChange = (val: string | number) => {
    const end = parseFloat(val.toString());
    if (!isNaN(end) && end >= 0) {
      if (loopStart < end && isLooping) {
        controller.playback.handleLoop(loopStart, end, true);
      }
    }
  };

  const toggleLoop = () => {
    if (isLooping) {
      controller.playback.handleLoop(0, 0, false);
    } else {
      controller.playback.handleLoop(loopStart, loopEnd, true);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 16px',
        background: '#252525',
        borderBottom: '1px solid #333',
        color: '#fff',
        fontSize: '13px',
      }}
    >
      {/* Controls */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => controller.playback.handlePlay()}
          disabled={isPlaying}
          style={btnStyle}
        >
          Play
        </button>
        <button
          onClick={() => controller.playback.handleStop()}
          style={btnStyle}
        >
          Stop
        </button>
        <button
          onClick={() => controller.playback.handlePause()}
          disabled={!isPlaying}
          style={btnStyle}
        >
          Pause
        </button>
      </div>

      <div style={{ width: '1px', height: '24px', background: '#444' }} />

      {/* Time */}
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '16px',
          minWidth: '60px',
          textAlign: 'center',
        }}
      >
        {currentTime}s
      </div>

      <div style={{ width: '1px', height: '24px', background: '#444' }} />

      {/* BPM */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <label>BPM</label>
        <DebouncedInput
          value={bpm}
          onChange={handleBpmChange}
          style={inputStyle}
          debounce={500}
        />
      </div>

      <div style={{ width: '1px', height: '24px', background: '#444' }} />

      {/* Loop */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={toggleLoop}
          style={{ ...btnStyle, background: isLooping ? '#4a9eff' : '#333' }}
        >
          Loop
        </button>
        {isLooping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <DebouncedInput
              value={loopStart}
              onChange={handleLoopStartChange}
              style={inputStyle}
              placeholder="Start"
            />
            <span>-</span>
            <DebouncedInput
              value={loopEnd}
              onChange={handleLoopEndChange}
              style={inputStyle}
              placeholder="End"
            />
          </div>
        )}
      </div>

      <div style={{ width: '1px', height: '24px', background: '#444' }} />

      {/* Master Volume */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <label>Master</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          onChange={e =>
            controller.playback.handleMasterVolume(parseFloat(e.target.value))
          }
          style={{ width: '80px' }}
        />
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  background: '#333',
  border: '1px solid #444',
  color: '#fff',
  padding: '4px 8px',
  borderRadius: '4px',
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  background: '#111',
  border: '1px solid #444',
  color: '#fff',
  padding: '2px 4px',
  borderRadius: '4px',
  width: '40px',
  textAlign: 'center',
};
