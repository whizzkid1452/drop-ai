import { create } from 'zustand';
import { createChatSlice, type ChatSlice } from './slices/chatSlice';
import { createAgentSlice, type AgentSlice } from './slices/agentSlice';

interface AppState extends ChatSlice, AgentSlice { }

export const useAppStore = create<AppState>()((...a) => ({
    ...createChatSlice(...a),
    ...createAgentSlice(...a),
}));
