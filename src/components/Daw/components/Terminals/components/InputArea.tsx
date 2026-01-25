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
    // 🔧 영어, 숫자, 공백, 기본 기호만 허용 (한글 및 기타 언어 차단)
    // 허용: a-z, A-Z, 0-9, space, -, _, ., ,, !, ?, ', ", :, ;, (, ), [, ], etc.
    const filteredValue = value.replace(/[^a-zA-Z0-9\s\-_.,!?'":;()\[\]{}@#$%^&*+=<>\/\\|`~]/g, '');
    onInputChange(filteredValue);
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
