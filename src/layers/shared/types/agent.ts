export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
}

export type AgentModelStatus = 'loading' | 'ready' | 'error';

export type AgentStatus = 'idle' | 'generating' | 'executing' | 'error';

export type AgentRunStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'cancelled';
