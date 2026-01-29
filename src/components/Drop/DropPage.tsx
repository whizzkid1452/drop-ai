import { useCallback, useState } from 'react';
import type { AudioFile } from '../../types/audioFile';
import { AudioFileDrop } from '../common/FileDrop/AudioFileDrop';
import { ChatModalTerminal } from '../Daw/components/Terminals/AgentTerminal/ChatModalTerminal';
import * as styles from './DropPage.css';

export function DropPage() {
  const [uploadedFile, setUploadedFile] = useState<null | AudioFile>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const onAudioFileDrop = useCallback((audioFile: AudioFile | null) => {
    if (audioFile == null) {
      return;
    }
    setUploadedFile(audioFile);
    setIsModalOpen(true);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.cardGroup}>
        <AudioFileDrop onAudioFileDrop={onAudioFileDrop} />
      </div>

      {uploadedFile != null && isModalOpen && (
        <ChatModalTerminal
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
