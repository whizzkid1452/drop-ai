import { useState } from 'react';
import { createConsoleApp } from '../../main-factory';

export const useCliApp = () => {
  // Initialize the app logic (same as CLI)
  // We use useState lazy initialization to create it once
  const [app] = useState(() => createConsoleApp());
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = async () => {
    await app.controller.playback.handlePlay();
    // @todo session을 reactive하게 변경할 필요가 있음
    // Manually sync state since Session is not reactive yet
    setIsPlaying(app.session.isPlaying);
  };

  const handleStop = () => {
    app.controller.playback.handleStop();
    setIsPlaying(app.session.isPlaying);
  };

  return {
    app,
    isPlaying,
    handlePlay,
    handleStop,
  };
};
