import { createContext, use } from 'react';
import type { AppInstance } from '../../create-app';

export const LayerContext = createContext<AppInstance | null>(null);

export function useLayer(): AppInstance {
  const context = use(LayerContext);
  if (!context) {
    throw new Error('useLayer must be used within a LayerProvider');
  }

  return context;
}
