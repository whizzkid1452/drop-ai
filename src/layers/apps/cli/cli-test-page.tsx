import { useState } from 'react';
import { LayerProvider } from '../../presentation/context/LayerContext';
import { MockAudioEngine } from '../../audio-engine/mock-audio-engine';
import { useCliApp } from './index';

/**
 * CLI 앱의 UI를 담당하는 순수 컴포넌트
 */
const CliTestContent = () => {
  // 모든 비즈니스 로직과 상태를 훅에서 가져옵니다.
  const { isPlaying, trackCount, logs, play, stop, addTrack } = useCliApp();

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>CLI Logic Test (Layer Architecture)</h1>

      {/* 상태 표시 영역 */}
      <div
        style={{
          marginBottom: '20px',
          padding: '10px',
          border: '1px solid #ddd',
        }}
      >
        <div>
          Status:{' '}
          <strong style={{ color: isPlaying ? 'green' : 'red' }}>
            {isPlaying ? 'PLAYING' : 'STOPPED'}
          </strong>
        </div>
        <div>
          Tracks: <strong>{trackCount}</strong>
        </div>
      </div>

      {/* 컨트롤 영역 */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={play}
          disabled={isPlaying}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            cursor: 'pointer',
          }}
        >
          Play
        </button>
        <button
          onClick={stop}
          disabled={!isPlaying}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            cursor: 'pointer',
          }}
        >
          Stop
        </button>
        <button
          onClick={addTrack}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Add Random Track
        </button>
      </div>

      {/* 로그 출력 영역 */}
      <div
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          height: '250px',
          overflowY: 'auto',
          backgroundColor: '#f5f5f5',
        }}
      >
        <h3>Real-time Logs</h3>
        {logs.length === 0 && (
          <div style={{ color: '#888' }}>No actions yet...</div>
        )}
        {logs.map((log, i) => (
          <div
            key={i}
            style={{ borderBottom: '1px solid #eee', padding: '2px 0' }}
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CliTestPage = () => {
  // 엔진 인스턴스만 관리하고 Provider를 통해 하위에 공유합니다.
  const [mockEngine] = useState(() => new MockAudioEngine());

  return (
    <LayerProvider engine={mockEngine}>
      <CliTestContent />
    </LayerProvider>
  );
};
