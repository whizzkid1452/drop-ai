import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useCliApp, type CliCommands } from '../index';
import { isCommandsType } from '../constants';

type WriteInitialHelpProps = {
  terminal: Terminal;
  commands: CliCommands;
};

  const writeInitialHelp = async ({ terminal:term, commands }: WriteInitialHelpProps): Promise<void> => {
    try {
      const helpOutput = await commands.help.fn();
      term.write(helpOutput.replace(/\n/g, '\r\n') + '\r\n\r\n');//줄바꿈 형식 변환(\n -> \r\n)
      term.write('drop-ai > ');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      term.write(`\r\nError: ${message}\r\ndrop-ai >`);
    }
  };

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

    const term = new Terminal({ //Terminal 인스턴스 생성
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
    //commandsRef.current의 현재값(명령어 객체)를 가져와서 help 라는 키로 해당 프로퍼티를 읽는다
    //help프로퍼티 객체 메서드 fn을 호출하고 그 결과를 helpOutput 변수에 할당한다.

    writeInitialHelp({ terminal:term, commands: commandsRef.current });

    xtermRef.current = term;

    const handleCommand = async (input: string) => {
      //배열 구조분해할당 (첫번째 요소를 cmdName, 나머지를 args 배열에 할당)
      const [cmdName, ...args] = input.trim().split(/\s+/);
      if (!cmdName) return;

      if (!isCommandsType(cmdName)) {
        term.write(`\r\nUnknown command: ${cmdName}. Type "help" for usage.`);
        return;
      }

      const command = commandsRef.current[cmdName];
      if (command) {
        try {
          //promise가 끝날때까지 await로 기다린 뒤 결과를 output 변수에 할당한다.
          const output = await command.fn(...args);
          term.write(`\r\n${output.replace(/\n/g, '\r\n')}`);
        } catch (err: unknown) {
          //instanceof : 진짜 Error 객체인지 체크
          const message = err instanceof Error ? err.message : 'Unknown error';
          term.write(`\r\nError: ${message}`);
        }
      } else {
        term.write(`\r\nUnknown command: ${cmdName}. Type "help" for usage.`);
      }
    };

    term.onData(async (data: string) => {
      switch (data) {
        case '\r': // Enter > 현재 버퍼를 명령으로 실행
          await handleCommand(inputBufferRef.current); //handleCommand 함수 호출
          inputBufferRef.current = '';
          term.write('\r\ndrop-ai > ');
          term.focus();
          break;
        case '\u007F': // Backspace
          if (inputBufferRef.current.length > 0) {
            inputBufferRef.current = inputBufferRef.current.slice(0, -1); //buffer에서 마지막 한글자 제거 (처음부터 마지막 직전까지)
            term.write('\b \b'); //마지막 한글자 지우기
          }
          break;
        default:
          if (
            //ASCII 문자 범위 체크 
            data >= String.fromCharCode(0x20) && //0x20: 공백(스페이스)
            data <= String.fromCharCode(0x7e) //0x7e: ~
          ) {
            inputBufferRef.current += data; //buffer에 문자 추가
            term.write(data); //터미널에 문자 출력
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
