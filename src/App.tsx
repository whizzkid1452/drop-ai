import { useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DefaultLayout } from '@/layers/apps/web/layouts/DefaultLayout';
import { AppRouter } from '@/layers/apps/web/router/AppRouter';
import { AnalyticsTracker } from '@/layers/apps/web/components/common/AnalyticsTracker';
import { ProWebLLMPreloader } from '@/layers/apps/web/components/common/ProWebLLMPreloader';
import { LayerProvider } from './layers/apps/web/context/layer-provider';
import { createWebApp } from './layers/apps/create-web-app';

function App() {
  const app = useMemo(() => createWebApp(), []);

  return (
    <LayerProvider app={app}>
      <ProWebLLMPreloader />
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
