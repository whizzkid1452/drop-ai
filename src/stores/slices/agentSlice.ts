import type { StateCreator } from 'zustand';

export interface AgentSlice {
    isModelReady: boolean;
    modelLoadingProgress: number;
    modelLoadingText: string;

    agentActions: {
        setModelReady: (ready: boolean) => void;
        setLoadingProgress: (progress: number, text: string) => void;
    };
}

export const createAgentSlice: StateCreator<AgentSlice> = (set) => ({
    isModelReady: false,
    modelLoadingProgress: 0,
    modelLoadingText: 'Initializing...',

    agentActions: {
        setModelReady: (ready) => set({ isModelReady: ready }),
        setLoadingProgress: (progress, text) =>
            set({ modelLoadingProgress: progress, modelLoadingText: text }),
    },
});
