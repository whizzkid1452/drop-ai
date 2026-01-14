import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DefaultLayout } from '@/components/Layouts/DefaultLayout';
import { AppRouter } from './router/AppRouter';
import { AudioEngine } from '@/logics/audio/audioEngine';
import { useTrackStore } from '@/stores/useTrackStore';
import { usePlaybackStore } from '@/stores/usePlaybackStore';

function App() {
  const [isAudioEngineReady, setIsAudioEngineReady] = useState(false);

  // AudioEngine 초기화 (앱 시작 시 한 번만)
  useEffect(() => {
    try {
      AudioEngine.initialize({
      /**
       * 현재 프로젝트의 모든 트랙 가져오기
       */
      getTracks: () => {
        return Array.from(useTrackStore.getState().tracks.values());
      },

      /**
       * Export 범위 가져오기
       */
      getExportRange: () => {
        const { exportStartTime, exportEndTime } = usePlaybackStore.getState();
        if (exportStartTime === null || exportEndTime === null) {
          return null;
        }
        return { startTime: exportStartTime, endTime: exportEndTime };
      },

      /**
       * 트랙 업데이트 (UI 동기화)
       */
      updateTrack: (trackId, update) => {
        useTrackStore.getState().updateTrack({
          trackId,
          updater: track => ({ ...track, ...update }),
        });
      },

      /**
       * 재생 상태 업데이트 (UI 동기화)
       */
      updatePlaybackState: (state) => {
        const playbackStore = usePlaybackStore.getState();
        if (state.isPlaying !== undefined) {
          playbackStore.setIsPlaying(state.isPlaying);
        }
        if (state.currentTime !== undefined) {
          playbackStore.setCurrentTime(state.currentTime);
        }
      },

      /**
       * Export 범위 설정
       */
      setExportRange: (startTime, endTime) => {
        usePlaybackStore.getState().setExportRange(startTime, endTime);
      },
    });

      console.log('[App] AudioEngine initialized');
      setIsAudioEngineReady(true);
    } catch (error) {
      console.error('[App] Failed to initialize AudioEngine:', error);
      // 초기화 실패 시에도 앱은 렌더링 (에러 바운더리에서 처리)
      setIsAudioEngineReady(true);
    }
  }, []); // 빈 배열: 마운트 시 한 번만 실행

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
        <AppRouter />
      </BrowserRouter>
    </DefaultLayout>
  );
}

export default App;
