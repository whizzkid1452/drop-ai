import React, { createContext, use, useMemo } from 'react';
import { useStore } from 'zustand';
import { createApp } from '../create-app';
import { type IAudioEngine } from '../../audio-engine/i-audio-engine';
import { type SessionStore, type SessionData } from '../../session/session';
import type { AppController } from '@/layers/controllers';

interface LayerContextValue {
  session: SessionStore;
  controller: AppController;
}

const LayerContext = createContext<LayerContextValue | null>(null);

interface LayerProviderProps {
  engine: IAudioEngine;
  children: React.ReactNode;
}

export const LayerProvider: React.FC<LayerProviderProps> = ({
  engine,
  children,
}) => {
  const value = useMemo(() => createApp(engine), [engine]);

  return (
    <LayerContext.Provider value={value}>{children}</LayerContext.Provider>
  );
};

/**
 * Internal hook to access the context
 */
function useLayer() {
  const context = use(LayerContext);
  if (!context) {
    throw new Error('useLayer must be used within a LayerProvider');
  }
  return context;
}

/**
 * Hook to access the AppController for executing actions.
 */
export function useController(): AppController {
  return useLayer().controller;
}

/**
 * Custom hook to subscribe to the Session state reactively.
 * Bridges Zustand Vanilla Store to React.
 */
export function useSession<T>(selector: (state: SessionData) => T): T {
  const { session } = useLayer();
  return useStore(session, selector);
}
