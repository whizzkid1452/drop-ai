import type { PropsWithChildren } from 'react';
import type { AppInstance } from '../../create-app';
import { LayerContext } from './layer-context';

interface LayerProviderProps extends PropsWithChildren {
  app: AppInstance;
}

export function LayerProvider({ app, children }: LayerProviderProps) {
  return <LayerContext.Provider value={app}>{children}</LayerContext.Provider>;
}
