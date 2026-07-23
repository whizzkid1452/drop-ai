import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/layers/apps/web/context/layer-hooks';
import { useAgent } from '@/layers/apps/web/hooks/agent/useAgent/useAgent';
import { useWebLLM } from '@/layers/apps/web/hooks/agent/useWebLLM';
import * as styles from './ChatModalTerminal.css.ts';
import { AgentTerminalHeader } from './components/AgentTerminalHeader';
import { CommandComposer } from './components/CommandComposer';
import { MessageList } from './components/MessageList';
import { ModelLoadingOverlay } from './components/ModelLoadingOverlay';
import { QuickGuide } from './components/QuickGuide';

export function AgentTerminal() {
  const [input, setInput] = useState('');
  const modelStatus = useSession(state => state.agentModelStatus);
  const modelLoadingProgress = useSession(state => state.modelLoadingProgress);
  const modelLoadingText = useSession(state => state.modelLoadingText);

  const { sendMessage, stopGeneration, messages, status } = useAgent();
  const { resetEngine, purgeCache, retryInitialization } = useWebLLM();

  const isGenerating = status === 'generating';
  const isBusy = isGenerating || status === 'executing';
  const isModelReady = modelStatus === 'ready';
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const handleSend = () => {
    if (!input.trim() || isBusy || !isModelReady) return;
    void sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && isGenerating) {
      event.preventDefault();
      stopGeneration();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (command: string) => {
    setInput(command);
  };

  const handleReset = () => {
    void resetEngine(false);
  };

  return (
    <div className={styles.container}>
      <AgentTerminalHeader onReset={handleReset} onPurgeCache={purgeCache} />

      {modelStatus !== 'ready' && (
        <ModelLoadingOverlay
          status={modelStatus}
          progress={modelLoadingProgress}
          loadingText={modelLoadingText}
          onRetry={() => void retryInitialization()}
        />
      )}

      <div className={styles.terminalBody} ref={scrollRef}>
        <div className={styles.gridBackground} />
        <QuickGuide isModelReady={isModelReady} onSuggestionClick={handleSuggestionClick} />
        <MessageList messages={messages} agentStatus={status} />
      </div>

      <CommandComposer
        input={input}
        modelStatus={modelStatus}
        agentStatus={status}
        onInputChange={setInput}
        onSend={handleSend}
        onStop={stopGeneration}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
