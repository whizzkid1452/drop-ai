import type { StateCreator } from 'zustand';
import type { Message, AgentStatus } from '@/types/agent';

export interface ChatSlice {
    messages: Message[];
    status: AgentStatus;

    actions: {
        addMessage: (message: Message) => void;
        updateMessage: (id: string, content: string) => void;
        setStatus: (status: AgentStatus) => void;
        clearMessages: () => void;
    };
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
    messages: [],
    status: 'idle',

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
        clearMessages: () => set({ messages: [] }),
    },
});
