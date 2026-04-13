import { useCliApp } from './index';
import { CliTerminal } from './ui/CliTerminal';

const CliTestContent = () => {
  const { isPlaying, trackCount } = useCliApp();

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: 'monospace',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h1>CLI Logic Terminal (xterm.js)</h1>
      <div
        style={{
          marginBottom: '10px',
          padding: '10px',
          border: '1px solid #ddd',
          background: '#f9f9f9',
        }}
      >
        <span>
          Status:{' '}
          <strong style={{ color: isPlaying ? 'green' : 'red' }}>
            {isPlaying ? 'PLAYING' : 'STOPPED'}
          </strong>
        </span>
        <span style={{ marginLeft: '20px' }}>
          Tracks: <strong>{trackCount}</strong>
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', border: '1px solid #333' }}>
        <CliTerminal />
      </div>
    </div>
  );
};

export const CliTestPage = () => {
  return <CliTestContent />;
};
