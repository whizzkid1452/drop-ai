import type { KeyboardEvent } from 'react';
import * as styles from '../AgentTerminal/AgentTerminal.css.ts';

interface InputAreaProps {
  input: string;
  isModelReady: boolean;
  isGenerating: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function InputArea({
  input,
  isModelReady,
  isGenerating,
  onInputChange,
  onSend,
}: InputAreaProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleInputChange = (value: string) => {
    // 모든 언어 입력 허용
    onInputChange(value);
  };

  return (
    <div className={styles.inputArea}>
      <textarea
        className={styles.textarea}
        value={input}
        onChange={e => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isModelReady
            ? "e.g., 'play', 'export 10-20', 'pause', 'stop'"
            : 'Waiting for model...'
        }
        rows={4}
        disabled={!isModelReady || isGenerating}
      />
    </div>
  );
}
