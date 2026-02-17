import { useRef, useEffect } from 'react';
import { LayerProvider } from '../context/LayerContext';
import { AudioEngine } from '@/layers/audio-engine/audio-engine';
import { WebLayout } from './layout/WebLayout';

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
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <h2>Work in Progress</h2>
          <p>Transport, TrackList, and Timeline components will go here.</p>
        </div>
      </WebLayout>
    </LayerProvider>
  );
};
