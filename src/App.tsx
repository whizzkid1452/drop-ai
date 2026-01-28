import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useErrorBoundary } from 'react-error-boundary';
import { DefaultLayout } from '@/components/Layouts/DefaultLayout';
import { AppRouter } from './router/AppRouter';
import { AnalyticsTracker } from '@/components/common/AnalyticsTracker';
import { AudioService } from '@/core/audio/AudioService';
import { Session } from '@/core/session/Session';


function App() {
  const [isAudioEngineReady, setIsAudioEngineReady] = useState(false);
  const { showBoundary } = useErrorBoundary();

  // AudioEngine 초기화 (앱 시작 시 한 번만)
  // AudioService 초기화 (앱 시작 시 한 번만)
  useEffect(() => {
    try {
      // 1. Session (Project) 생성
      const session = new Session();

      // 2. AudioService (Engine) 초기화
      AudioService.initialize(session);

      console.log('[App] AudioService initialized');
      setIsAudioEngineReady(true);
    } catch (error) {
      console.error('[App] Failed to initialize AudioService:', error);
      showBoundary(error);
    }
  }, [showBoundary]); // 빈 배열: 마운트 시 한 번만 실행

  // AudioEngine이 초기화될 때까지 대기
  if (!isAudioEngineReady) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading Audio Engine...
      </div>
    );
  }

  return (
    <DefaultLayout>
      <BrowserRouter>
        <AnalyticsTracker />
        <AppRouter />
      </BrowserRouter>
    </DefaultLayout>
  );
}

export default App;
