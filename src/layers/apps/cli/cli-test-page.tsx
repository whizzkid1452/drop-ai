import { useEffect, useRef, useState, useMemo } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { LayerProvider } from '../web/context/LayerContext';
import { createSessionStore } from '../../session';
import { AudioEngine } from '../../audio-engine';
import { useCliApp, type CliCommands } from './index';

// --- Command Palette Component ---
// Helper to parse usage string into variants and arguments
interface CommandVariant {
  template: string; // "track add <id> [url]"
  parts: Array<{ type: 'keyword' | 'arg', value: string, optional?: boolean }>;
}

const parseUsage = (usage: string): CommandVariant[] => {
  return usage.split('|').map(v => {
    const template = v.trim();
    const tokens = template.split(/\s+/);
    const parts = tokens.map(token => {
      if (token.startsWith('<') && token.endsWith('>')) {
        return { type: 'arg' as const, value: token.slice(1, -1), optional: false };
      }
      if (token.startsWith('[') && token.endsWith(']')) {
        return { type: 'arg' as const, value: token.slice(1, -1), optional: true };
      }
      return { type: 'keyword' as const, value: token };
    });
    return { template, parts };
  });
};

const CommandForm = ({ commandName, usage, onRun }: { commandName: string, usage: string, onRun: (cmd: string) => void }) => {
  const variants = useMemo(() => parseUsage(usage), [usage]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [argValues, setArgValues] = useState<Record<string, string>>({});

  const currentVariant = variants[selectedVariantIndex];

  const handleRun = () => {
    // Construct command
    const cmdParts = currentVariant.parts.map((p, idx) => {
      if (p.type === 'keyword') return p.value;
      const key = `${selectedVariantIndex}-${idx}-${p.value}`;
      return argValues[key] || '';
    });
    // Filter empty optional args if any (though logic above might leave extra spaces, let's trim)
    const cmdString = cmdParts.filter(s => s !== '').join(' ');
    onRun(cmdString);
  };

  return (
    <div style={{ background: '#333', padding: '10px', borderRadius: '4px', marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong style={{ color: '#4ec9b0' }}>{commandName}</strong>
      </div>
      
      {/* Variant Selector if multiple */}
      {variants.length > 1 && (
        <div style={{ marginBottom: '8px' }}>
          <select 
            value={selectedVariantIndex}
            onChange={(e) => {
              setSelectedVariantIndex(Number(e.target.value));
              setArgValues({}); // Clear args on switch
            }}
            style={{ width: '100%', padding: '4px', background: '#222', color: '#eee', border: '1px solid #444' }}
          >
            {variants.map((v, idx) => (
              <option key={idx} value={idx}>{v.template}</option>
            ))}
          </select>
        </div>
      )}

      {/* Inputs for Arguments */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
        {currentVariant.parts.map((part, idx) => {
          if (part.type === 'keyword') return null;
          const key = `${selectedVariantIndex}-${idx}-${part.value}`;
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <label style={{ fontSize: '0.8em', color: '#aaa', minWidth: '60px' }}>{part.value}{part.optional ? '?' : ''}:</label>
               <input 
                 type="text"
                 value={argValues[key] || ''}
                 onChange={(e) => setArgValues(prev => ({ ...prev, [key]: e.target.value }))}
                 placeholder={part.optional ? '(optional)' : ''}
                 style={{ flex: 1, background: '#222', border: '1px solid #444', color: 'white', padding: '4px' }}
                 onKeyDown={(e) => { if (e.key === 'Enter') handleRun(); }}
               />
            </div>
          );
        })}
      </div>

      <button 
        onClick={handleRun}
        style={{ 
          width: '100%',
          background: '#0e639c', 
          color: 'white', 
          border: 'none', 
          padding: '6px', 
          borderRadius: '2px', 
          cursor: 'pointer' 
        }}
      >
        Run
      </button>
    </div>
  );
};

const CommandPalette = ({ commands, onRun }: { commands: CliCommands, onRun: (cmd: string) => void }) => {
  return (
    <div style={{ 
      width: '350px', 
      borderLeft: '1px solid #333', 
      background: '#252526', 
      color: '#ccc',
      overflowY: 'auto',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #444', paddingBottom: '5px' }}>Command Palette</h3>
      {Object.entries(commands).map(([name, cmd]) => (
        <CommandForm key={name} commandName={name} usage={cmd.usage} onRun={onRun} />
      ))}
    </div>
  );
};

// --- Main Content Component ---
const CliTestContent = () => {
  const { isPlaying, trackCount, commands, currentTime, tempo } = useCliApp();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const inputBufferRef = useRef<string>('');
  const commandsRef = useRef(commands);

  // Keep commands ref updated
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  // Execute command logic
  const runCommand = async (input: string) => {
    const term = xtermRef.current;
    if (!term) return;

    if (input.trim().length === 0) {
       term.write('\r\ndrop-ai > ');
       return;
    }

    const [cmdName, ...args] = input.trim().split(/\s+/);
    if (!cmdName) return;

    const command = commandsRef.current[cmdName];
    if (command) {
      try {
        const output = await command.fn(...args);
        term.write(`\r\n${output.replace(/\n/g, "\r\n")}`);
      } catch (err: any) {
        term.write(`\r\nError: ${err.message}`);
      }
    } else {
      term.write(`\r\nUnknown command: ${cmdName}. Type "help" for usage.`);
    }
    term.write('\r\ndrop-ai > ');
  };

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, monospace',
      fontSize: 14,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#aeafad',
        selectionBackground: '#3a3d41'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    term.focus();

    term.write('Welcome to Drop-AI CLI (xterm.js)\r\n');
    term.write('Type "help" or use the panel on the right.\r\n\r\n');
    term.write('drop-ai > ');

    xtermRef.current = term;

    // Handle terminal input
    term.onData(async (data: string) => {
      switch (data) {
        case '\r': // Enter
          term.write('\r\n');
          await runCommand(inputBufferRef.current);
          inputBufferRef.current = '';
          break;
        case '\u007F': // Backspace
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            term.write('\b \b');
          }
          break;
        default:
          if (data >= String.fromCharCode(0x20) && data <= String.fromCharCode(0x7E)) {
            inputBufferRef.current += data;
            term.write(data);
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
  }, []); // Run once on mount

  // Wrapper for external calls (like from UI)
  const handleUiRun = (cmd: string) => {
     // Echo command to terminal for visibility
     xtermRef.current?.write(cmd);
     // Simulate Enter behavior
     xtermRef.current?.write('\r\n');
     runCommand(cmd);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1e1e', color: 'white' }}>
      {/* Header / Status Bar */}
      <div style={{ 
        padding: '10px 20px', 
        borderBottom: '1px solid #333', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: '#2d2d2d'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.2em' }}>CLI Logic Terminal</h2>
        <div style={{ display: 'flex', gap: '20px', fontSize: '0.9em' }}>
            <span>Status: <strong style={{ color: isPlaying ? '#4ec9b0' : '#f48771' }}>{isPlaying ? 'PLAYING' : 'STOPPED'}</strong></span>
            <span>Tracks: <strong>{trackCount}</strong></span>
            <span>Time: <strong>{currentTime.toFixed(2)}s</strong></span>
            <span>Tempo: <strong>{tempo} BPM</strong></span>
        </div>
      </div>
      
      {/* Main Content: Terminal + Palette */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
           <div ref={terminalRef} style={{ flex: 1, width: '100%', height: '100%' }} />
        </div>
        <CommandPalette commands={commands} onRun={handleUiRun} />
      </div>
    </div>
  );
};

export const CliTestPage = () => {
  // Use real AudioEngine and SessionStore for integration testing
  const engine = useMemo(() => {
    const sessionStore = createSessionStore();
    return new AudioEngine(sessionStore);
  }, []);

  return (
    <LayerProvider engine={engine}>
        <CliTestContent />
    </LayerProvider>
  );
};
