import { ErrorBoundary } from 'react-error-boundary';
import { GlobalErrorFallback } from './layers/apps/web/components/common/ErrorBoundary/GlobalErrorFallback';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReactGA from 'react-ga4';
import App from './App.tsx';
import '@/styles/global.css.ts';

// TanStack Query 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Google Analytics 4 초기화 (프로덕션 환경에서만)
const GA_ID = import.meta.env.VITE_GA_ID;
if (import.meta.env.PROD && GA_ID) {
  ReactGA.initialize(GA_ID);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary
        FallbackComponent={GlobalErrorFallback}
        onReset={() => {
          // Reset the state of your app so the error doesn't happen again
          window.location.reload();
        }}
      >
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>
);
