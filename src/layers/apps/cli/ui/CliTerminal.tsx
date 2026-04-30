import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useCliApp } from '../index';
import { isCommandsType } from '../constants';

export const CliTerminal = () => {
  const { commands } = useCliApp();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const inputBufferRef = useRef<string>('');
  const commandsRef = useRef(commands);

  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]); //commands 최신값 유지

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#33ff33',
        cursor: '#ffcc00',
      },
      fontFamily: 'monospace',
      fontSize: 14,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    term.focus();

    term.write('Welcome to Drop-AI CLI (xterm.js)\r\n');
    // 초기 로드 시 help 명령어 자동 실행 결과 출력
    const helpOutput = commandsRef.current['help'].fn() as string;
    term.write(helpOutput.replace(/\n/g, '\r\n') + '\r\n\r\n');
    term.write('drop-ai > ');

    xtermRef.current = term;

    const handleCommand = async (input: string) => {
      const [cmdName, ...args] = input.trim().split(/\s+/);
      if (!cmdName) return;

      if (!isCommandsType(cmdName)) {
        term.write(`\r\nUnknown command: ${cmdName}. Type "help" for usage.`);
        return;
      }

      const command = commandsRef.current[cmdName];
      if (command) {
        try {
          const output = await command.fn(...args);
          term.write(`\r\n${output.replace(/\n/g, '\r\n')}`);
        } catch (err: any) {
          term.write(`\r\nError: ${err.message}`);
        }
      } else {
        term.write(`\r\nUnknown command: ${cmdName}. Type "help" for usage.`);
      }
    };

    term.onData(async (data: string) => {
      switch (data) {
        case '\r': // Enter
          await handleCommand(inputBufferRef.current);
          inputBufferRef.current = '';
          term.write('\r\ndrop-ai > ');
          term.focus();
          break;
        case '\u007F': // Backspace
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            term.write('\b \b');
          }
          break;
        default:
          if (
            data >= String.fromCharCode(0x20) &&
            data <= String.fromCharCode(0x7e)
          ) {
            inputBufferRef.current += data;
            term.write(data);
          }
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    // Initial fit after a short delay to ensure container is rendered
    setTimeout(() => fitAddon.fit(), 0);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
      xtermRef.current = null;
    };
  }, []);

  return (
    <div
      ref={terminalRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      onClick={() => xtermRef.current?.focus()}
    />
  );
};
