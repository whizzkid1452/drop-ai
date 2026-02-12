import { useState, useRef, type KeyboardEvent, useEffect } from 'react';
import * as styles from './CliTerminal.css.ts';
import { useController, useSessionStore } from '@/layers/apps/web/context/LayerContext';
import { executeAudioCommand } from '@/layers/controllers/utils/command-dispatcher';
import { parseAudioCommandString } from '@/types/audioCommand.schema';

interface LogItem {
  id: string;
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: number;
}

export function CliTerminal() {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const controller = useController();
  const sessionStore = useSessionStore();
  
  const execute = async (command: any) => {
      await executeAudioCommand(controller, sessionStore.getState(), command);
  };

  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: LogItem['type'] = 'info') => {
    setLogs(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type,
        message,
      },
    ]);
  };

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  const executeCommand = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    addLog(`> ${trimmedInput}`, 'info');

    try {
      // Use parseAudioCommandString for consistent validation and array support
      const { commands, error } = parseAudioCommandString({
        commandString: trimmedInput,
      });

      if (error) {
        addLog(`Error: ${error}`, 'error');
        return;
      }

      if (!commands || commands.length === 0) {
        addLog('Error: No valid commands found', 'error');
        return;
      }

      // Execute all commands sequentially
      for (const command of commands) {
        await execute(command);
        addLog(`Executed: ${command.type}`, 'success');
      }

      setInput(''); // Clear input on success
    } catch (err) {
      if (err instanceof Error) {
        addLog(`Error: ${err.message}`, 'error');
      } else {
        addLog('Unknown error occurred', 'error');
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.titeBar}>Audio Engine CLI</div>
      <div className={styles.logArea}>
        {logs.map(log => (
          <div
            key={log.id}
            className={`${styles.logItem} ${log.type === 'error'
              ? styles.logItemError
              : log.type === 'success'
                ? styles.logItemSuccess
                : ''
              }`}
          >
            {log.message}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
      <div className={styles.inputArea}>
        <textarea
          className={styles.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Enter JSON command (e.g., { "type": "PLAY" })'
        />
        <div className={styles.helpfulText}>Press Enter to execute</div>
      </div>
    </div>
  );
}
