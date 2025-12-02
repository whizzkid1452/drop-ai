import { useEffect, useRef, useState } from 'react';
import type { WaveformStyle } from '../../../types/ui';

interface WaveformProps {
  buffer: AudioBuffer;
  style?: WaveformStyle;
  className?: string;
}

export function Waveform({ buffer, style = {}, className }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const {
      lineColor = '#c693ff',
      fillColor = 'rgba(198, 147, 255, 0.15)',
      height = 60,
      showCenterLine = true,
    } = style;

    const canvas = document.createElement('canvas');

    const containerWidth = containerRef.current.offsetWidth || 200;
    const containerHeight = containerRef.current.offsetHeight || height;

    canvas.width = containerWidth * (window.devicePixelRatio || 1);
    canvas.height = containerHeight * (window.devicePixelRatio || 1);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const centerY = containerHeight / 2;
    const channelCount = buffer.numberOfChannels;
    const channelDataLeft = buffer.getChannelData(0);
    const channelDataRight =
      channelCount > 1 ? buffer.getChannelData(1) : channelDataLeft;
    const samplesPerPixel = Math.max(
      1,
      Math.floor(channelDataLeft.length / containerWidth)
    );

    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, containerWidth, containerHeight);

    if (showCenterLine) {
      ctx.strokeStyle = '#4a2f6f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(containerWidth, centerY);
      ctx.stroke();
    }

    ctx.fillStyle = lineColor;

    for (let x = 0; x < containerWidth; x++) {
      const start = x * samplesPerPixel;
      let max = 0;
      for (
        let i = 0;
        i < samplesPerPixel && start + i < channelDataLeft.length;
        i++
      ) {
        const sample = Math.abs(channelDataLeft[start + i]);
        max = Math.max(max, sample);
      }
      const waveformHeight = max * (containerHeight / 2);
      if (waveformHeight > 0) {
        ctx.fillRect(x, centerY - waveformHeight, 1, waveformHeight);
      }
    }

    for (let x = 0; x < containerWidth; x++) {
      const start = x * samplesPerPixel;
      let max = 0;
      for (
        let i = 0;
        i < samplesPerPixel && start + i < channelDataRight.length;
        i++
      ) {
        const sample = Math.abs(channelDataRight[start + i]);
        max = Math.max(max, sample);
      }
      const waveformHeight = max * (containerHeight / 2);
      if (waveformHeight > 0) {
        ctx.fillRect(x, centerY, 1, waveformHeight);
      }
    }

    containerRef.current.appendChild(canvas);
    setIsReady(true);

    return () => {
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    };
  }, [buffer, style]);

  return (
    <div ref={containerRef} className={className}>
      {!isReady && <div>Loading...</div>}
    </div>
  );
}

export default Waveform;
