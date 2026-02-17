import { useRef, useEffect } from 'react';
import { LayerProvider } from '../context/LayerContext';
import { AudioEngine } from '@/layers/audio-engine/audio-engine';
import { WebLayout } from './layout/WebLayout';
import { Transport } from './ui/Transport';
import { TrackList } from './ui/TrackList';

export const WebDAW = () => {
  // Using a singleton-like ref pattern for AudioEngine to persist across renders
  // In a real app, this might be lifted higher or managed via Context/Singleton
  const audioEngine = useRef(new AudioEngine()).current;

  useEffect(() => {
    // Expose engine for debugging/tests
    // @ts-expect-error - Exposing audio engine for debugging
    window.audioEngine = audioEngine;
  }, [audioEngine]);

  return (
    <LayerProvider engine={audioEngine}>
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
    </LayerProvider>
  );
};
