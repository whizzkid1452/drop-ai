import { useState, useRef, type KeyboardEvent, useEffect } from 'react';
import * as styles from './CliTerminal.css';
import { useAudioCommand } from '@/logics/audio';

interface LogItem {
  id: string;
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: number;
}

export function CliTerminal() {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const { execute } = useAudioCommand();
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
      const parsed = JSON.parse(trimmedInput);
      const commands = Array.isArray(parsed) ? parsed : [parsed];

      for (const command of commands) {
        // Basic type validation check
        if (!command.type) {
          throw new Error('Command must have a "type" property.');
        }

        // Execute command
        const result = await execute(command);

        if (result !== undefined) {
          addLog(JSON.stringify(result, null, 2), 'success');
        } else {
          addLog(`Executed: ${command.type}`, 'success');
        }
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
