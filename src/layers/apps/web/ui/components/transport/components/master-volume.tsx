import { useController } from '../../../../../context/LayerContext';

export const TransportMasterVolume = () => {
  const controller = useController();

  return (
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
  );
};
