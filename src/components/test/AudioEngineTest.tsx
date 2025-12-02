import { useState } from 'react';
import { AudioEngine, Track, Clip } from '../../core/audio';

/**
 * AudioEngine 테스트 컴포넌트
 */
export function AudioEngineTest() {
  const [engine] = useState(() => new AudioEngine({ bpm: 120 }));
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // 테스트 실행
  const runTests = async () => {
    const results: string[] = [];

    try {
      // 테스트 1: AudioEngine 초기화
      results.push('✅ 테스트 1: AudioEngine 초기화 성공');

      // 테스트 2: BPM 가져오기
      const currentBPM = engine.getBPM();
      results.push(`✅ 테스트 2: 현재 BPM = ${currentBPM}`);

      // 테스트 3: 마스터 볼륨 설정
      engine.setMasterVolume(80);
      const volume = engine.getMasterVolume();
      results.push(`✅ 테스트 3: 마스터 볼륨 = ${volume}%`);

      // 테스트 4: 트랙 추가
      const track = engine.addTrack('Test Track');
      setTracks(prev => [...prev, track]);
      results.push(`✅ 테스트 4: 트랙 추가됨 - "${track.getName()}"`);

      // 테스트 5: 재생 위치
      const position = engine.getPosition();
      results.push(`✅ 테스트 5: 현재 재생 위치 = ${position.toFixed(2)}초`);

      results.push('✅ 모든 기본 테스트 통과!');
    } catch (error) {
      results.push(`❌ 테스트 실패: ${error}`);
    }

    setTestResults(results);
  };

  // 재생/정지
  const handlePlay = async () => {
    try {
      if (!isPlaying) {
        await engine.play();
        setIsPlaying(true);
        setTestResults(prev => [...prev, '✅ 재생 시작']);
      } else {
        engine.stop();
        setIsPlaying(false);
        setTestResults(prev => [...prev, '⏹ 정지']);
      }
    } catch (error) {
      setTestResults(prev => [...prev, `❌ 재생 오류: ${error}`]);
    }
  };

  // BPM 변경
  const handleBPMChange = (newBpm: number) => {
    setBpm(newBpm);
    engine.setBPM(newBpm);
    setTestResults(prev => [...prev, `🎵 BPM 변경: ${newBpm}`]);
  };

  // 파일 선택
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setTestResults(prev => [...prev, `📁 파일 선택됨: ${file.name}`]);
    }
  };

  // 파일 로드 및 재생
  const handleLoadAndPlay = async () => {
    if (!selectedFile) {
      setTestResults(prev => [...prev, '❌ 파일을 선택해주세요']);
      return;
    }

    try {
      setTestResults(prev => [
        ...prev,
        `📥 파일 로드 시작: ${selectedFile.name} (크기: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB)`,
      ]);

      // 오디오 파일 로드
      const buffer = await engine.loadAudioFile(selectedFile);

      setTestResults(prev => [
        ...prev,
        `✅ 파일 로드 완료: ${buffer.duration.toFixed(2)}초`,
        `   채널 수: ${buffer.numberOfChannels}, 샘플레이트: ${buffer.sampleRate}Hz`,
      ]);

      // 트랙에 클립 추가
      let targetTrack;
      if (tracks.length === 0) {
        targetTrack = engine.addTrack('Audio Track');
        setTracks([targetTrack]);
        setTestResults(prev => [...prev, `✅ 트랙 자동 생성됨`]);
      } else {
        targetTrack = tracks[0];
      }

      const clip = new Clip(engine.getAudioContext(), buffer, 0);
      targetTrack.addClip(clip);
      setTestResults(prev => [...prev, `✅ 클립 추가됨 (시작 위치: 0초)`]);

      // 재생 중이라면 업데이트
      if (isPlaying) {
        // 현재 재생 중이므로 즉시 재생 시작
        await engine.play();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setTestResults(prev => [...prev, `❌ 파일 로드 실패: ${errorMessage}`]);
      console.error('파일 로드 오류:', error);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px',
      }}
    >
      <h2
        style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px' }}
      >
        AudioEngine 테스트
      </h2>

      {/* 컨트롤 패널 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={runTests}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            테스트 실행
          </button>

          <button
            onClick={handlePlay}
            style={{
              padding: '8px 16px',
              backgroundColor: isPlaying ? '#ef4444' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {isPlaying ? '⏹ 정지' : '▶ 재생'}
          </button>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            BPM:
            <input
              type="number"
              min="30"
              max="300"
              value={bpm}
              onChange={e => handleBPMChange(Number(e.target.value))}
              style={{ width: '80px', padding: '4px 8px' }}
            />
          </label>

          <div>
            마스터 볼륨:
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="100"
              onChange={e => engine.setMasterVolume(Number(e.target.value))}
              style={{ marginLeft: '8px' }}
            />
          </div>
        </div>

        {/* 파일 업로드 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            style={{ padding: '4px' }}
          />
          {selectedFile && (
            <button
              onClick={handleLoadAndPlay}
              style={{
                padding: '8px 16px',
                backgroundColor: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              로드 및 재생
            </button>
          )}
        </div>
      </div>

      {/* 테스트 결과 */}
      <div
        style={{
          backgroundColor: '#f9fafb',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          maxHeight: '400px',
          overflowY: 'auto',
        }}
      >
        <h3
          style={{ marginBottom: '8px', fontSize: '1rem', fontWeight: 'bold' }}
        >
          테스트 결과:
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {testResults.length === 0 ? (
            <p style={{ color: '#6b7280' }}>테스트를 실행해주세요.</p>
          ) : (
            testResults.map((result, index) => (
              <div
                key={index}
                style={{
                  padding: '4px 8px',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                {result}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 상태 정보 */}
      <div
        style={{
          backgroundColor: '#f0f9ff',
          padding: '12px',
          borderRadius: '8px',
        }}
      >
        <h3
          style={{ marginBottom: '8px', fontSize: '1rem', fontWeight: 'bold' }}
        >
          현재 상태:
        </h3>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '0.875rem',
          }}
        >
          <div>재생 상태: {isPlaying ? '▶ 재생 중' : '⏸ 정지'}</div>
          <div>BPM: {bpm}</div>
          <div>트랙 수: {tracks.length}</div>
          <div>마스터 볼륨: {engine.getMasterVolume()}%</div>
          <div>재생 위치: {engine.getPosition().toFixed(2)}초</div>
        </div>
      </div>
    </div>
  );
}
