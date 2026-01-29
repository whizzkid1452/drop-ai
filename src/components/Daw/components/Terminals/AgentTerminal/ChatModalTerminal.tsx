import { useAgent } from '@/hooks/agent/useAgent/useAgent';
import { useWebLLM } from '@/hooks/agent/useWebLLM';
import { useAgentStore } from '@/stores/useAgentStore';
import { useState } from 'react';
import * as styles from './AgentTerminal.css';
import { ActionButtons } from '../components/ActionButtons';
import { InputArea } from '../components/InputArea';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { MessageList } from '../components/MessageList';

interface ChatModalTerminalProps {
  onClose?: () => void;
}

export function ChatModalTerminal({ onClose }: ChatModalTerminalProps) {
  const [input, setInput] = useState('');
  const isModelReady = useAgentStore(state => state.isModelReady);
  const modelLoadingProgress = useAgentStore(
    state => state.modelLoadingProgress
  );
  const modelLoadingText = useAgentStore(state => state.modelLoadingText);

  const { sendMessage, messages, status } = useAgent();
  const { resetEngine, purgeCache } = useWebLLM();

  const isGenerating = status === 'generating';

  const handleSend = () => {
    if (!input.trim() || isGenerating || !isModelReady) return;

    sendMessage(input.trim());
    setInput('');
  };

  const handleReset = () => {
    resetEngine(false);
  };

  const content = (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Drop AI Agent </div>
        <div className={styles.headerActions}>
          <ActionButtons
            isGenerating={isGenerating}
            onReset={handleReset}
            onPurgeCache={purgeCache}
          />
          {onClose && (
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
          )}
        </div>
      </div>

      {!isModelReady && (
        <LoadingOverlay
          text={modelLoadingText}
          progress={modelLoadingProgress}
        />
      )}

      <MessageList messages={messages} isModelReady={isModelReady} />

      <InputArea
        input={input}
        isModelReady={isModelReady}
        isGenerating={isGenerating}
        onInputChange={setInput}
        onSend={handleSend}
      />
    </div>
  );

  if (onClose) {
    return (
      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modalContainer} onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return content;
}
