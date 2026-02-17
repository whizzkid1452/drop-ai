import type { TrackState } from '@/layers/session/session';
import { useController } from '../../../../../context/LayerContext';

interface TrackItemProps {
  track: TrackState;
}

export const TrackItem = ({ track }: TrackItemProps) => {
  const controller = useController();

  // Simple handlers calling controller methods
  const handleVol = (val: number) =>
    controller.track.setTrackVolume(track.id, val);
  const handlePan = (val: number) =>
    controller.track.setTrackPan(track.id, val);
  const handleMute = () =>
    controller.track.setTrackMute(track.id, !track.isMuted);
  const handleSolo = () =>
    controller.track.setTrackSolo(track.id, !track.isSoloed);
  const handleRemove = () => controller.track.removeTrack(track.id);

  return (
    <div
      data-testid="track-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px',
        background: '#2a2a2a',
        color: '#eee',
        borderBottom: '1px solid #333',
        fontSize: '12px',
        minWidth: '280px', // Ensure enough width
      }}
    >
      {/* Name / ID */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <strong>{track.name || 'Untitled'}</strong>
        <div style={{ fontSize: '10px', color: '#888' }}>
          {track.id.slice(0, 8)}...
        </div>
      </div>

      {/* Vol Slider */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <label style={{ fontSize: '10px' }}>
          Vol ({track.volume.toFixed(1)})
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={track.volume}
          onChange={e => handleVol(parseFloat(e.target.value))}
          style={{ width: '60px' }}
        />
      </div>

      {/* Pan Slider */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <label style={{ fontSize: '10px' }}>Pan ({track.pan.toFixed(1)})</label>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.1"
          value={track.pan}
          onChange={e => handlePan(parseFloat(e.target.value))}
          style={{ width: '60px' }}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <button
          onClick={handleMute}
          style={{
            ...btnStyle,
            background: track.isMuted ? '#ff4d4d' : '#333',
          }}
        >
          M
        </button>
        <button
          onClick={handleSolo}
          style={{
            ...btnStyle,
            background: track.isSoloed ? '#ffc107' : '#333',
            color: track.isSoloed ? '#000' : '#fff',
          }}
        >
          S
        </button>
        <button
          onClick={handleRemove}
          style={{ ...btnStyle, color: '#aaa', fontSize: '10px' }}
        >
          X
        </button>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  background: '#333',
  border: '1px solid #444',
  color: '#fff',
  width: '24px',
  height: '24px',
  borderRadius: '4px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold',
};
