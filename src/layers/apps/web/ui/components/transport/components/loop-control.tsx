import React from 'react';
import { useController, useSession } from '../../../../../context/LayerContext';
import { useShallow } from 'zustand/react/shallow';
import { DebouncedInput } from '@/components/common/DebouncedInput';
import type { SessionData } from '@/layers/session/session';

export const TransportLoopControl = () => {
  const controller = useController();
  const { isLooping, loopStart, loopEnd } = useSession(
    useShallow((state: SessionData) => ({
      isLooping: state.isLooping,
      loopStart: state.loopStart,
      loopEnd: state.loopEnd,
    }))
  );

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

  return (
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
  );
};
