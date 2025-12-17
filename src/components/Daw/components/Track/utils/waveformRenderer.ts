/**
 * Canvas 기반 파형 렌더러 유틸리티
 * Web Audio API를 사용하여 오디오 파형을 Canvas에 렌더링
 */

export interface WaveformConfig {
  height: number;
  waveColor: string;
  progressColor: string;
  cursorColor: string;
  barWidth: number;
  barGap: number;
  barRadius: number;
  normalize: boolean;
}

export interface WaveformData {
  peaks: Float32Array;
  duration: number;
}

/**
 * AudioBuffer에서 파형 데이터 추출
 * 
 * @param audioBuffer - Web Audio API AudioBuffer
 * @param samples - 추출할 샘플 수 (줌 레벨에 따라 조정)
 * @returns 파형 데이터 (peaks 배열)
 */
export function extractWaveformData(
  audioBuffer: AudioBuffer,
  samples: number = 2000
): WaveformData {
  const rawData = audioBuffer.getChannelData(0); // 첫 번째 채널 사용
  const blockSize = Math.floor(rawData.length / samples);
  const peaks = new Float32Array(samples);

  // 각 블록의 최대값 추출
  for (let i = 0; i < samples; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, rawData.length);
    let max = 0;

    for (let j = start; j < end; j++) {
      const abs = Math.abs(rawData[j]);
      if (abs > max) {
        max = abs;
      }
    }

    peaks[i] = max;
  }

  // 정규화 (normalize 옵션에 따라)
  const maxPeak = Math.max(...Array.from(peaks));
  if (maxPeak > 0) {
    for (let i = 0; i < peaks.length; i++) {
      peaks[i] = peaks[i] / maxPeak;
    }
  }

  return {
    peaks,
    duration: audioBuffer.duration,
  };
}

/**
 * Canvas에 파형 렌더링
 * 
 * @param canvas - Canvas 요소
 * @param waveformData - 파형 데이터
 * @param config - 렌더링 설정
 * @param progress - 재생 진행률 (0.0 ~ 1.0)
 */
export function renderWaveform(
  canvas: HTMLCanvasElement,
  waveformData: WaveformData,
  config: WaveformConfig,
  progress: number = 0
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { peaks } = waveformData;
  const {
    waveColor,
    progressColor,
    cursorColor,
    barWidth,
    barGap,
    barRadius,
  } = config;

  // devicePixelRatio 고려하여 실제 표시 크기 계산
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = canvas.width / dpr;
  const displayHeight = canvas.height / dpr;

  // Canvas 초기화
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f0f10';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 바 개수 계산
  const totalBarWidth = barWidth + barGap;
  const maxBars = Math.floor(displayWidth / totalBarWidth);
  const barsToRender = Math.min(peaks.length, maxBars);
  const centerY = displayHeight / 2;

  // 진행률에 따른 바 인덱스 계산
  const progressBarIndex = Math.floor(progress * barsToRender);

  // 파형 렌더링
  for (let i = 0; i < barsToRender; i++) {
    const x = i * totalBarWidth;
    const peak = peaks[Math.floor((i / barsToRender) * peaks.length)];
    const barHeight = peak * (displayHeight * 0.8); // 80% 높이 사용

    // 진행률에 따라 색상 결정
    const isProgress = i < progressBarIndex;
    const isCurrent = i === progressBarIndex;

    ctx.fillStyle = isCurrent ? cursorColor : isProgress ? progressColor : waveColor;

    // 위쪽 바
    if (barHeight > 0) {
      ctx.beginPath();
      ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight / 2, barRadius);
      ctx.fill();
    }

    // 아래쪽 바
    if (barHeight > 0) {
      ctx.beginPath();
      ctx.roundRect(x, centerY, barWidth, barHeight / 2, barRadius);
      ctx.fill();
    }
  }
}

