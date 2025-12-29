import type { StateCreator } from 'zustand';
import type { Message, AgentStatus } from '@/types/agent';

export interface ChatSlice {
    messages: Message[];
    status: AgentStatus;
    currentStreamToken: string;

    actions: {
        addMessage: (message: Message) => void;
        updateMessage: (id: string, content: string) => void;
        setStatus: (status: AgentStatus) => void;
        appendToken: (token: string) => void;
        clearMessages: () => void;
    };
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
    messages: [],
    status: 'idle',
    currentStreamToken: '',

    actions: {
        addMessage: (message) =>
            set((state) => ({ messages: [...state.messages, message] })),
        updateMessage: (id, content) =>
            set((state) => ({
                messages: state.messages.map((m) =>
                    m.id === id ? { ...m, content } : m
                ),
            })),
        setStatus: (status) => set({ status }),
        appendToken: (token) =>
            set((state) => ({ currentStreamToken: state.currentStreamToken + token })),
        clearMessages: () => set({ messages: [] }),
    },
});
