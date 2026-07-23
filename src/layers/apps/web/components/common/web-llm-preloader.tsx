import { useWebLLM } from '@/layers/apps/web/hooks/agent/useWebLLM';

export function WebLLMPreloader() {
  useWebLLM();

  return null;
}
