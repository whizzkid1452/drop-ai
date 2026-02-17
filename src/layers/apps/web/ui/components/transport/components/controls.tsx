import React from 'react';
import { useController, useSession } from '../../../../../context/LayerContext';
import { useShallow } from 'zustand/react/shallow';
import type { SessionData } from '@/layers/session/session';

export const TransportControls = () => {
  const controller = useController();
  const isPlaying = useSession(
    useShallow((state: SessionData) => state.isPlaying)
  );

  const btnStyle: React.CSSProperties = {
    background: '#333',
    border: '1px solid #444',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        onClick={() => controller.playback.handlePlay()}
        disabled={isPlaying}
        style={btnStyle}
      >
        Play
      </button>
      <button onClick={() => controller.playback.handleStop()} style={btnStyle}>
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
  );
};
