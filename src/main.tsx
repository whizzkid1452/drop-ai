import { ErrorBoundary } from 'react-error-boundary';
import { GlobalErrorFallback } from './components/common/ErrorBoundary/GlobalErrorFallback';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import './styles/global.css';

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
