import { useAgent } from '@/layers/apps/web/hooks/agent/useAgent/useAgent';
import { useWebLLM } from '@/layers/apps/web/hooks/agent/useWebLLM';
import { useAgentStore } from '@/stores/useAgentStore';
import { useState, useRef, useEffect } from 'react';
import * as styles from './ChatModalTerminal.css.ts';
import { AgentTerminalHeader } from './components/AgentTerminalHeader';
import { ModelLoadingOverlay } from './components/ModelLoadingOverlay';
import { QuickGuide } from './components/QuickGuide';
import { MessageList } from './components/MessageList';
import { CommandComposer } from './components/CommandComposer';

export function AgentTerminal() {
  const [input, setInput] = useState('');
  const isModelReady = useAgentStore(state => state.isModelReady);
  const modelLoadingProgress = useAgentStore(
    state => state.modelLoadingProgress
  );
  const modelLoadingText = useAgentStore(state => state.modelLoadingText);

  const { sendMessage, messages, status } = useAgent();
  const { resetEngine, purgeCache } = useWebLLM();

  const isGenerating = status === 'generating';
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  const handleSend = () => {
    if (!input.trim() || isGenerating || !isModelReady) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (command: string) => {
    setInput(command);
  };

  const handleReset = () => {
    resetEngine(false);
  };

  return (
    <div className={styles.container}>
      <AgentTerminalHeader onReset={handleReset} onPurgeCache={purgeCache} />

      {!isModelReady && (
        <ModelLoadingOverlay
          progress={modelLoadingProgress}
          loadingText={modelLoadingText}
        />
      )}

      <div className={styles.terminalBody} ref={scrollRef}>
        <div className={styles.gridBackground} />
        <QuickGuide
          isModelReady={isModelReady}
          onSuggestionClick={handleSuggestionClick}
        />
        <MessageList messages={messages} isGenerating={isGenerating} />
      </div>

      <CommandComposer
        input={input}
        isModelReady={isModelReady}
        isGenerating={isGenerating}
        onInputChange={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
