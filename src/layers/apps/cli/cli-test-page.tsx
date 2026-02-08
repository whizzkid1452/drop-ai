import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { LayerProvider } from '../../presentation/context/LayerContext';
import { MockAudioEngine } from '../../audio-engine/mock-audio-engine';
import { useCliApp } from './index';

const CliTestContent = () => {
  const { isPlaying, trackCount, commands } = useCliApp();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const inputBufferRef = useRef<string>('');

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#33ff33',
        cursor: '#ffcc00',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    term.write('Welcome to Drop-AI CLI (xterm.js)\r\n');
    term.write('Type "help" to see available commands.\r\n\r\n');
    term.write('drop-ai > ');

    xtermRef.current = term;

    const handleCommand = async (input: string) => {
      const [cmdName, ...args] = input.trim().split(/\s+/);
      if (!cmdName) return;

      const command = commands[cmdName];
      if (command) {
        try {
          const output = await command.fn(...args);
          term.write(`\r\n${output.replace(/\n/g, '\r\n')}`);
        } catch (err: any) {
          term.write(`\r\nError: ${err.message}`);
        }
      } else {
        term.write(`\r\nUnknown command: ${cmdName}`);
      }
    };

    term.onData(async e => {
      switch (e) {
        case '\r': // Enter
          await handleCommand(inputBufferRef.current);
          inputBufferRef.current = '';
          term.write('\r\ndrop-ai > ');
          break;
        case '\u007F': // Backspace
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            term.write('\b \b');
          }
          break;
        default:
          if (
            e >= String.fromCharCode(0x20) &&
            e <= String.fromCharCode(0x7e)
          ) {
            inputBufferRef.current += e;
            term.write(e);
          }
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      xtermRef.current = null;
    };
  }, [commands]);

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
      <div ref={terminalRef} style={{ flex: 1, overflow: 'hidden' }} />
    </div>
  );
};

export const CliTestPage = () => {
  // MockEngine을 사용하는 App 인스턴스를 LayerProvider로 감싸 하위에서 공유합니다.
  const mockEngine = useRef(new MockAudioEngine()).current;

  return (
    <LayerProvider engine={mockEngine}>
      <CliTestContent />
    </LayerProvider>
  );
};
