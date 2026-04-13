import { WebLayout } from './layout/WebLayout';
import { Transport } from './ui/components/transport/transport';
import { TrackList } from './ui/components/track-list/track-list';

export const WebDAW = () => {
  return (
    <WebLayout>
      <div
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <Transport />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <TrackList />
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              flexDirection: 'column',
              gap: '16px',
              background: '#121212',
            }}
          >
            <h2>Timeline Placeholder</h2>
            <p>Arrangement view will go here.</p>
          </div>
        </div>
      </div>
    </WebLayout>
  );
};
