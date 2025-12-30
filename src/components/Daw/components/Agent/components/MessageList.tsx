import { useRef, useEffect } from 'react';
import * as styles from '../AgentInterface.css';
import type { Message } from '@/types/agent';
import { WELCOME_MESSAGE } from '../constants';

interface MessageListProps {
    messages: Message[];
    isModelReady: boolean;
}

export function MessageList({ messages, isModelReady }: MessageListProps) {
    const messageEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className={styles.messageArea}>
            {messages.length === 0 && isModelReady && (
                <div className={`${styles.assistantMessage} ${styles.welcomeMessage}`}>
                    {WELCOME_MESSAGE.split('\n').map((line, i) => (
                        <span key={i}>
                            {line}
                            {i < WELCOME_MESSAGE.split('\n').length - 1 && <br />}
                        </span>
                    ))}
                </div>
            )}

            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={`${styles.messageBubble} ${
                        msg.role === 'user' ? styles.userMessage : styles.assistantMessage
                    }`}
                >
                    <div className={styles.messageContent}>{msg.content}</div>
                </div>
            ))}
            <div ref={messageEndRef} />
        </div>
    );
}

