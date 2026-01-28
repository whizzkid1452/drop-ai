import { useState, type KeyboardEvent } from 'react';
import { useAgent } from '@/hooks/agent/useAgent/useAgent';
import { useWebLLM } from '@/hooks/agent/useWebLLM';
import { useAgentStore } from '@/stores/useAgentStore';
import type { AudioFile } from '../../types/audioFile';
import * as styles from './DropChatModal.css';

interface DropChatModalProps {
  audioFile: AudioFile;
  onClose: () => void;
  onContinue: () => void;
}

export function DropChatModal({
  audioFile,
  onClose,
  onContinue,
}: DropChatModalProps) {
  const [input, setInput] = useState('');

  const isModelReady = useAgentStore(state => state.isModelReady);
  const modelLoadingText = useAgentStore(state => state.modelLoadingText);

  const { sendMessage, status } = useAgent();
  const { resetEngine, purgeCache } = useWebLLM();

  const isGenerating = status === 'generating';

  const handleSend = () => {
    if (!input.trim() || isGenerating || !isModelReady) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const triggerQuickAction = (prompt: string) => {
    // 버튼 클릭 시 채팅 입력창에만 세팅하고, Enter로 실행
    setInput(prompt);
  };

  const handleReset = () => {
    resetEngine(false);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon}>graphic_eq</span>
            <h2 className={styles.headerTitle}>AI DAW</h2>
          </div>
          <div className={styles.headerRight}>
            <button
              type="button"
              className={styles.headerButton}
              onClick={handleReset}
              title="Reset model"
            >
              <span className={styles.headerIcon}>settings</span>
            </button>
            <div
              className={styles.headerAvatar}
              style={{
                backgroundImage:
                  'url("https://lh3.googleusercontent.com/aida-public/AB6AXuACaxWISl8jGCxzdYFYUnGWyyh4cOjG8kQl_brWRgwTwf5U3ZEvOUtLEWlMcPgKYkuHrJBIYDyYnqyg5Yy_LZ3susWaQ2Up5nRp6S0DqslTiwT5jjXp9wcGNd9Q9--UD6Q8ZkRtz0OGV8OjycYs6_nerbdwCWJY3JUk4e1txtcUWpwv3uKmOtN5AsIyvWsAL_oMG_LHHML06Hn_3pXgClqd6pmGGIGDnfHwgasO4jbJL0KAHyRbo5tJYIhpZvy-IaHUqUPsxqIqWbI")',
              }}
            />
          </div>
        </header>

        <main className={styles.main}>
          <div className={styles.inner}>
            <div className={styles.fileTabWrapper}>
              <div className={styles.fileTab}>
                <span className={styles.fileTabIcon}>audio_file</span>
                {audioFile.name}
              </div>
              <button
                type="button"
                className={styles.fileTabClose}
                onClick={onClose}
                aria-label="Close"
              >
                close
              </button>
            </div>

            <div className={styles.inputCard}>
              <div className={styles.inputWrapper}>
                <span className={styles.promptCaret}>&gt;</span>
                <textarea
                  autoFocus
                  className={styles.textarea}
                  placeholder={
                    isModelReady
                      ? 'Ask AI to edit, clean or transform this track...'
                      : modelLoadingText || 'Waiting for model...'
                  }
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={!isModelReady || isGenerating}
                />
              </div>
              <div className={styles.runHint}>
                <span>Run</span>
                <span className={styles.hintIcon}>keyboard_return</span>
              </div>
            </div>

            <div className={styles.quickActions}>
              <button
                type="button"
                className={styles.quickButton}
                onClick={() => triggerQuickAction('export 10-20')}
              >
                export 10-20
              </button>
              <button
                type="button"
                className={styles.quickButton}
                onClick={() => triggerQuickAction('set volume to 0.8')}
              >
                volume 80%
              </button>
              <button
                type="button"
                className={styles.quickButton}
                onClick={() => triggerQuickAction('pan track 30% left')}
              >
                pan 30% L
              </button>
            </div>
          </div>
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerLeft}>
            <span className={styles.footerStatusDot} />
            <span>{isModelReady ? 'Ready' : 'Loading model'}</span>
          </div>
          <div className={styles.footerRight}>
            <span>CPU: 2%</span>
            <span>MEM: 14%</span>
            <button
              type="button"
              className={styles.footerButton}
              onClick={onContinue}
            >
              Preview track
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

