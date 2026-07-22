import React, { createContext, use } from 'react';
import { useStore } from 'zustand';
import type { AppInstance } from '../../create-app';
import { AppController } from '../../../controllers/app-controller';
import { type SessionStore, type SessionState } from '../../../session/session';
import type { CommandExecutor } from '../../../commands/command-executor';

interface LayerContextValue {
  session: SessionStore;
  controller: AppController;
  commandExecutor: CommandExecutor;
}

const LayerContext = createContext<LayerContextValue | null>(null);

interface LayerProviderProps {
  app: AppInstance;
  children: React.ReactNode;
}

export const LayerProvider: React.FC<LayerProviderProps> = ({ app, children }) => {
  return <LayerContext.Provider value={app}>{children}</LayerContext.Provider>;
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
 * UI와 Agent가 같은 명령 실행 경로를 사용하도록 조립된 실행기를 반환한다.
 */
export function useCommandExecutor(): CommandExecutor {
  return useLayer().commandExecutor;
}

/**
 * Custom hook to subscribe to the Session state reactively.
 * Bridges Zustand Vanilla Store to React.
 */
export function useSession<T>(selector: (state: SessionState) => T): T {
  const { session } = useLayer();
  return useStore(session, selector);
}

/**
 * Hook to access the raw SessionStore (Zustand store instance).
 * Useful for accessing state in callbacks without subscribing to updates.
 */
export function useSessionStore(): SessionStore {
  return useLayer().session;
}
