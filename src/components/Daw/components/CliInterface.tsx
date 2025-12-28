import { useState, useRef, type KeyboardEvent, useEffect } from 'react';
import * as styles from './CliInterface.css';
import { useAudioEngineHandleWithUi } from '@/hooks/useAudioEngineHandleWithUi';
import type { AudioCommand } from '@/types/audioEngine';

interface LogItem {
  id: string;
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: number;
}

export function CliInterface() {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<LogItem[]>([]);
  const { handleAudioCommand } = useAudioEngineHandleWithUi();
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

  const executeCommand = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    addLog(`> ${trimmedInput}`, 'info');

    try {
      const command = JSON.parse(trimmedInput);

      // Basic type validation check
      if (!command.type) {
        throw new Error('Command must have a "type" property.');
      }

      // Execute command
      handleAudioCommand(command as AudioCommand);
      addLog(`Executed: ${command.type}`, 'success');
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
            className={`${styles.logItem} ${
              log.type === 'error'
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
