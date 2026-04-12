import { useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DefaultLayout } from '@/components/Layouts/DefaultLayout';
import { AppRouter } from './router/AppRouter';
import { AnalyticsTracker } from '@/components/common/AnalyticsTracker';

// 신규 레이어 추가
import { AudioEngine } from './layers/audio-engine/audio-engine';
import { LayerProvider } from './layers/apps/context/LayerContext';

function App() {
  const audioEngine = useMemo(() => new AudioEngine(), []);

  return (
    <LayerProvider engine={audioEngine}>
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
