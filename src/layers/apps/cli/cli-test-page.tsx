import { useState } from 'react';
import { useCliApp } from './index';

export const CliTestPage = () => {
  const { app, isPlaying, handlePlay, handleStop } = useCliApp();
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev]);
  };

  const onPlay = async () => {
    addLog('Requesting Play...');
    await handlePlay();
    addLog(`Session State: isPlaying = ${app.session.isPlaying}`);
  };

  const onStop = () => {
    addLog('Requesting Stop...');
    handleStop();
    addLog(`Session State: isPlaying = ${app.session.isPlaying}`);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>CLI Logic Test (Web)</h1>
      <div style={{ marginBottom: '20px' }}>
        Status:{' '}
        <strong style={{ color: isPlaying ? 'green' : 'red' }}>
          {isPlaying ? 'PLAYING' : 'STOPPED'}
        </strong>
      </div>
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={onPlay}
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
          onClick={onStop}
          disabled={!isPlaying}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Stop
        </button>
      </div>
      <div
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          height: '300px',
          overflowY: 'auto',
          backgroundColor: '#f5f5f5',
        }}
      >
        <h3>Logs</h3>
        {logs.length === 0 && (
          <div style={{ color: '#888' }}>No logs yet...</div>
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
