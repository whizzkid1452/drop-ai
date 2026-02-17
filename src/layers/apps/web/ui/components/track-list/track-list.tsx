import { useSession, useController } from '../../../../context/LayerContext';
import { TrackItem } from './components/track-item';

export const TrackList = () => {
  const controller = useController();
  const tracks = useSession(state => state.tracks);
  const trackList = Array.from(tracks.values());

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '320px',
        background: '#1e1e1e',
        borderRight: '1px solid #333',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#252525',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '14px', color: '#eee' }}>
          Tracks ({tracks.size})
        </h3>
        <button
          onClick={() => controller.track.addTrack()}
          style={{
            background: '#4a9eff',
            border: 'none',
            color: '#fff',
            padding: '4px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
          }}
        >
          + Add Track
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {trackList.map(track => (
          <TrackItem key={track.id} track={track} />
        ))}
        {trackList.length === 0 && (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: '#666',
              fontSize: '13px',
              fontStyle: 'italic',
            }}
          >
            No tracks created. <br />
            Click &quot;+ Add Track&quot; to begin.
          </div>
        )}
      </div>
    </div>
  );
};
