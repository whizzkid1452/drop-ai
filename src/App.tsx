import { useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DefaultLayout } from '@/layers/apps/web/layouts/DefaultLayout';
import { AppRouter } from '@/layers/apps/web/router/AppRouter';
import { AnalyticsTracker } from '@/layers/apps/web/components/common/AnalyticsTracker';
import { WebLLMPreloader } from '@/layers/apps/web/components/common/web-llm-preloader';
import { LayerProvider } from './layers/apps/web/context/layer-provider';
import { createApp } from './layers/apps/create-app';

function App() {
  const app = useMemo(() => createApp(), []);

  return (
    <LayerProvider app={app}>
      <WebLLMPreloader />
      <DefaultLayout>
        <BrowserRouter>
          <AnalyticsTracker />
          <AppRouter />
        </BrowserRouter>
      </DefaultLayout>
    </LayerProvider>
  );
}

export default App;
