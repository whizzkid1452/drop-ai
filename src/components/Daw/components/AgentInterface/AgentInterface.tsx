import { useState } from 'react';
import * as styles from './AgentInterface.css';
import { useChatStore } from '@/stores/useChatStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { useAgent } from '@/hooks/agent/useAgent';
import { useWebLLM } from '@/hooks/agent/useWebLLM';
import { ActionButtons } from './components/ActionButtons';
import { LoadingOverlay } from './components/LoadingOverlay';
import { MessageList } from './components/MessageList';
import { InputArea } from './components/InputArea';
import { AGENT_VERSION } from './constants';

export function AgentInterface() {
  const [input, setInput] = useState('');
  const messages = useChatStore(state => state.messages);
  const status = useChatStore(state => state.status);
  const isModelReady = useAgentStore(state => state.isModelReady);
  const modelLoadingProgress = useAgentStore(
    state => state.modelLoadingProgress
  );
  const modelLoadingText = useAgentStore(state => state.modelLoadingText);

  const { sendMessage } = useAgent();
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.title}>Drop AI Agent ({AGENT_VERSION})</div>
        <ActionButtons
          isGenerating={isGenerating}
          onReset={handleReset}
          onPurgeCache={purgeCache}
        />
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
}
