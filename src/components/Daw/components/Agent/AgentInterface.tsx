import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import * as styles from './AgentInterface.css';
import { useAppStore } from '@/stores/useAppStore';
import { useAgent } from '@/hooks/useAgent';
import { useWebLLM } from '@/hooks/useWebLLM';
import type { Message } from '@/types/agent';

const AGENT_VERSION = 'v2.8-HYBRID-MODE';
const WELCOME_MESSAGE = "Hello! I'm your AI Audio Engineer.\nHow can I help you with your project today?";
const PLACEHOLDER_READY = "예: '재생해줘', '볼륨 50으로', 'pause', '왼쪽으로'";
const PLACEHOLDER_LOADING = 'Waiting for model...';

interface ActionButtonsProps {
    isGenerating: boolean;
    onReset: () => void;
    onPurgeCache: () => void;
}

function ActionButtons({ isGenerating, onReset, onPurgeCache }: ActionButtonsProps) {
    return (
        <div className={styles.headerActions}>
            {isGenerating && (
                <div className={styles.generatingStatus}>Thinking...</div>
            )}
            <button onClick={onReset} className={styles.actionButton}>
                Reset Engine
            </button>
            <button onClick={onPurgeCache} className={`${styles.actionButton} ${styles.dangerButton}`}>
                Purge Cache
            </button>
        </div>
    );
}

interface LoadingOverlayProps {
    text: string;
    progress: number;
}

function LoadingOverlay({ text, progress }: LoadingOverlayProps) {
    return (
        <div className={styles.loadingOverlay}>
            <div>{text}</div>
            <div className={styles.progressBarContainer}>
                <div
                    className={styles.progressBarFill}
                    style={{ width: `${progress * 100}%` }}
                />
            </div>
        </div>
    );
}

interface MessageListProps {
    messages: Message[];
    isModelReady: boolean;
}

function MessageList({ messages, isModelReady }: MessageListProps) {
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

interface InputAreaProps {
    input: string;
    isModelReady: boolean;
    isGenerating: boolean;
    onInputChange: (value: string) => void;
    onSend: () => void;
}

function InputArea({ input, isModelReady, isGenerating, onInputChange, onSend }: InputAreaProps) {
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
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isModelReady ? PLACEHOLDER_READY : PLACEHOLDER_LOADING}
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

export function AgentInterface() {
    const [input, setInput] = useState('');
    const messages = useAppStore((state) => state.messages);
    const status = useAppStore((state) => state.status);
    const isModelReady = useAppStore((state) => state.isModelReady);
    const modelLoadingProgress = useAppStore((state) => state.modelLoadingProgress);
    const modelLoadingText = useAppStore((state) => state.modelLoadingText);

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
                <LoadingOverlay text={modelLoadingText} progress={modelLoadingProgress} />
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
