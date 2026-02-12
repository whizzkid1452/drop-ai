import { useEffect, useState, useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useErrorBoundary } from 'react-error-boundary';
import { DefaultLayout } from '@/layers/apps/web/layouts/DefaultLayout';
import { AppRouter } from '@/layers/apps/web/router/AppRouter';
import { AnalyticsTracker } from '@/layers/apps/web/components/common/AnalyticsTracker';

// 신규 레이어 추가
import { AudioEngine } from './layers/audio-engine';
import { LayerProvider } from './layers/apps/web/context/LayerContext';
import { createSessionStore } from './layers/session';

function App() {
  const [isAudioEngineReady, setIsAudioEngineReady] = useState(false);
  const { showBoundary } = useErrorBoundary();

  // 신규 레이어 엔진 생성 (실제 AudioEngine 사용)
  const audioEngine = useMemo(() => {
    const sessionStore = createSessionStore();
    return new AudioEngine(sessionStore);
  }, []);

  useEffect(() => {
    try {
      // 신규 로직: 준비 완료 상태 설정
      setIsAudioEngineReady(true);
    } catch (error) {
      console.error('[App] Failed to initialize Audio Engine:', error);
      showBoundary(error);
    }
  }, [showBoundary]);

  if (!isAudioEngineReady) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#666',
        }}
      >
        Loading Audio Engine...
      </div>
    );
  }

  return (
    // LayerProvider를 추가하되, 기존 DefaultLayout과 AppRouter는 그대로 둡니다.
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
