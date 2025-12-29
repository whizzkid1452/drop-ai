export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
    id: string;
    role: Role;
    content: string;
    toolCalls?: ToolCall[];
    toolCallId?: string;
    timestamp: number;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export type AgentStatus = 'idle' | 'loading' | 'generating' | 'error';
