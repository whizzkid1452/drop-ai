import React, { createContext, use } from 'react';
import { useStore } from 'zustand';
import type { AppInstance } from '../../create-app';
import type { SessionState } from '../../../session/session';
import type { CommandExecutor } from '../../../commands/command-executor';
import type { IPlaybackClockQuery } from '../../../queries/playback-clock-query';

const LayerContext = createContext<AppInstance | null>(null);

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
 * UI와 Agent가 같은 명령 실행 경로를 사용하도록 조립된 실행기를 반환한다.
 */
export function useCommandExecutor(): CommandExecutor {
  return useLayer().commandExecutor;
}

/**
 * 재생 위치를 변경하지 않고 AudioEngine의 현재 시각만 읽는 Query를 반환한다.
 */
export function usePlaybackClock(): IPlaybackClockQuery {
  return useLayer().playbackClock;
}

/**
 * Custom hook to subscribe to the Session state reactively.
 * Bridges Zustand Vanilla Store to React.
 */
export function useSession<T>(selector: (state: SessionState) => T): T {
  const { session } = useLayer();
  return useStore(session, selector);
}
