import React from 'react';
import { useController, useSession } from '../../../../context/LayerContext';
import { useShallow } from 'zustand/react/shallow';
import { DebouncedInput } from '@/components/common/DebouncedInput';
import type { SessionData } from '@/layers/session/session';

export const TransportBpmControl = () => {
  const controller = useController();
  const bpm = useSession(useShallow((state: SessionData) => state.bpm));

  const handleBpmChange = (val: string | number) => {
    const num = parseFloat(val.toString());
    if (!isNaN(num) && num > 0) controller.playback.handleBpm(num);
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <label>BPM</label>
      <DebouncedInput
        value={bpm}
        onChange={handleBpmChange}
        style={inputStyle}
        debounce={500}
      />
    </div>
  );
};
