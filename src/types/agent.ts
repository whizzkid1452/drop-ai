export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
    id: string;
    role: Role;
    content: string;
    timestamp: number;
}

export type AgentStatus = 'idle' | 'loading' | 'generating' | 'error';
