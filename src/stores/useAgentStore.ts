import { create } from 'zustand';

interface AgentState {
  isModelReady: boolean;
  modelLoadingProgress: number;
  modelLoadingText: string;

  actions: {
    setModelReady: (ready: boolean) => void;
    setLoadingProgress: (progress: number, text: string) => void;
  };
}

export const useAgentStore = create<AgentState>(set => ({
  isModelReady: false,
  modelLoadingProgress: 0,
  modelLoadingText: 'Initializing...',

  actions: {
    setModelReady: ready => set({ isModelReady: ready }),
    setLoadingProgress: (progress, text) =>
      set({ modelLoadingProgress: progress, modelLoadingText: text }),
  },
}));
