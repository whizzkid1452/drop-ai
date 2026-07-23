import type { AgentStatus, Message } from '@/types/agent';
import * as styles from '../ChatModalTerminal.css.ts';

interface MessageListProps {
  messages: Message[];
  agentStatus: AgentStatus;
}

export function MessageList({ messages, agentStatus }: MessageListProps) {
  const isBusy = agentStatus === 'generating' || agentStatus === 'executing';

  return (
    <div className={styles.messageGroup}>
      {messages.map((msg, i) => (
        <div key={msg.id ?? i} className={`${styles.messageRow} ${msg.role === 'user' ? styles.messageRowUser : ''}`}>
          <div className={`${styles.avatar} ${msg.role === 'assistant' ? styles.aiAvatar : ''}`}>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '16px',
                color: msg.role === 'assistant' ? styles.primaryColor : '#888',
              }}
            >
              {msg.role === 'assistant' ? 'smart_toy' : 'person'}
            </span>
          </div>
          <div className={`${styles.messageContent} ${msg.role === 'user' ? styles.messageContentUser : ''}`}>
            <div className={`${styles.messageHeader} ${msg.role === 'user' ? styles.messageHeaderUser : ''}`}>
              <span className={`${styles.senderName} ${msg.role === 'assistant' ? styles.aiSenderName : ''}`}>
                {msg.role === 'assistant' ? 'AI AGENT' : 'USER'}
              </span>
              <span className={styles.timestamp}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour12: false })}
              </span>
            </div>
            <div
              className={`${styles.bubble} ${msg.role === 'assistant' ? styles.aiBubble : ''} ${msg.role === 'user' ? styles.bubbleUser : ''}`}
            >
              {msg.content}
            </div>
          </div>
        </div>
      ))}

      {isBusy && (
        <div className={styles.systemMessage}>
          <div className={styles.systemInfo}>
            <span className={`material-symbols-outlined ${styles.spinning}`} style={{ fontSize: '14px' }}>
              sync
            </span>
            <span className={styles.systemText}>
              {agentStatus === 'generating' ? 'GENERATING RESPONSE...' : 'APPLYING COMMANDS...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
