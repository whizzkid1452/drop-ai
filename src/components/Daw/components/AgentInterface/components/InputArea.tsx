import type { KeyboardEvent } from 'react';
import * as styles from '../AgentInterface.css';

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

  return (
    <div className={styles.inputArea}>
      <textarea
        className={styles.textarea}
        value={input}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          isModelReady
            ? "예: '재생해줘', '볼륨 50으로', 'pause', '왼쪽으로'"
            : 'Waiting for model...'
        }
        rows={1}
        disabled={!isModelReady || isGenerating}
      />
      <div className={styles.inputHint}>
        <span>Shift + Enter for new line</span>
        <span>Press Enter to send</span>
      </div>
    </div>
  );
}
