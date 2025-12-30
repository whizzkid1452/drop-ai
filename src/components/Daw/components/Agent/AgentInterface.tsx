import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import * as styles from './AgentInterface.css';
import { useAppStore } from '@/stores/useAppStore';
import { useAgent } from '@/hooks/useAgent';
import { useWebLLM } from '@/hooks/useWebLLM';

export function AgentInterface() {
    const [input, setInput] = useState('');
    const messages = useAppStore((state) => state.messages);
    const status = useAppStore((state) => state.status);
    const isModelReady = useAppStore((state) => state.isModelReady);
    const modelLoadingProgress = useAppStore((state) => state.modelLoadingProgress);
    const modelLoadingText = useAppStore((state) => state.modelLoadingText);

    const { sendMessage } = useAgent();
    const { resetEngine, purgeCache } = useWebLLM();
    const messageEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, status]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSend = () => {
        if (!input.trim() || status === 'generating' || !isModelReady) return;
        sendMessage(input.trim());
        setInput('');
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.title}>Drop AI Agent (v2.8-HYBRID-MODE)</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {status === 'generating' && (
                        <div className={styles.generatingStatus}>Thinking...</div>
                    )}
                    <button
                        onClick={() => resetEngine(false)}
                        style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                    >
                        Reset Engine
                    </button>
                    <button
                        onClick={purgeCache}
                        style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            background: 'rgba(255,0,0,0.1)',
                            border: '1px solid rgba(255,0,0,0.2)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#ff4444'
                        }}
                    >
                        Purge Cache
                    </button>
                </div>
            </div>

            {!isModelReady && (
                <div className={styles.loadingOverlay}>
                    <div>{modelLoadingText}</div>
                    <div className={styles.progressBarContainer}>
                        <div
                            className={styles.progressBarFill}
                            style={{ width: `${modelLoadingProgress * 100}%` }}
                        />
                    </div>
                </div>
            )}

            <div className={styles.messageArea}>
                {messages.length === 0 && isModelReady && (
                    <div className={styles.assistantMessage} style={{ alignSelf: 'center', opacity: 0.5, textAlign: 'center' }}>
                        Hello! I'm your AI Audio Engineer.<br />How can I help you with your project today?
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`${styles.messageBubble} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage
                            }`}
                    >
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        {msg.toolCalls?.map((tc) => (
                            <div key={tc.id} className={styles.toolCall}>
                                🛠️ Invoking: {tc.function.name}
                            </div>
                        ))}
                    </div>
                ))}
                <div ref={messageEndRef} />
            </div>

            <div className={styles.inputArea}>
                <textarea
                    className={styles.textarea}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isModelReady ? "예: '재생해줘', '볼륨 50으로', 'pause', '왼쪽으로'" : "Waiting for model..."}
                    rows={1}
                    disabled={!isModelReady || status === 'generating'}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', opacity: 0.5, marginTop: '4px' }}>
                    <span>Shift + Enter for new line</span>
                    <span>Press Enter to send</span>
                </div>
            </div>
        </div>
    );
}
