import { useEffect, useState, useMemo } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useErrorBoundary } from 'react-error-boundary';
import { DefaultLayout } from '@/components/Layouts/DefaultLayout';
import { AppRouter } from './router/AppRouter';
import { AnalyticsTracker } from '@/components/common/AnalyticsTracker';

// 기존 로직 유지
import { AudioService } from '@/core/audio/AudioService';
import { Session as LegacySession } from '@/core/session/Session';

// 신규 레이어 추가
import { AudioEngine } from './layers/audio-engine/audio-engine';
import { LayerProvider } from './layers/apps/context/LayerContext';

function App() {
  const [isAudioEngineReady, setIsAudioEngineReady] = useState(false);
  const { showBoundary } = useErrorBoundary();

  // 신규 레이어 엔진 생성 (추가)
  const audioEngine = useMemo(() => new AudioEngine(), []);

  useEffect(() => {
    try {
      // 1. 기존 로직: Legacy Session 및 AudioService 초기화 (유지)
      const legacySession = new LegacySession();
      AudioService.initialize(legacySession);
      console.log('[App] Legacy AudioService initialized');

      // 2. 신규 로직: 준비 완료 상태 설정 (추가)
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
