import { useEffect, useState } from 'react';
import { useController } from '../../../../context/LayerContext';

export const TransportTimeDisplay = () => {
  const controller = useController();
  const [currentTime, setCurrentTime] = useState('0.00');

  useEffect(() => {
    let animationFrameId: number;
    const updateTime = () => {
      const time = controller.playback.getCurrentTime();
      setCurrentTime(time.toFixed(2));
      animationFrameId = requestAnimationFrame(updateTime);
    };
    updateTime();
    return () => cancelAnimationFrame(animationFrameId);
  }, [controller]);

  return (
    <div
      style={{
        fontFamily: 'monospace',
        fontSize: '16px',
        minWidth: '60px',
        textAlign: 'center',
      }}
    >
      {currentTime}s
    </div>
  );
};
