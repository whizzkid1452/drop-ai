import { useCallback, useState } from 'react';
import type { AudioFile } from '../../types/audioFile';
import { AudioFileDrop } from '../common/FileDrop/AudioFileDrop';
import { DropChatModal } from './DropChatModal';
import { DropPreviewModal } from './DropPreviewModal';
import * as styles from './DropPage.css';

export function DropPage() {
  const [uploadedFile, setUploadedFile] = useState<null | AudioFile>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const onAudioFileDrop = useCallback((audioFile: AudioFile | null) => {
    if (audioFile == null) {
      return;
    }
    setUploadedFile(audioFile);
    setIsChatOpen(true);
    setIsPreviewOpen(false);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.cardGroup}>
        <AudioFileDrop onAudioFileDrop={onAudioFileDrop} />
      </div>

      {uploadedFile != null && isChatOpen && (
        <DropChatModal
          audioFile={uploadedFile}
          onClose={() => setIsChatOpen(false)}
          onContinue={() => {
            setIsChatOpen(false);
            setIsPreviewOpen(true);
          }}
        />
      )}

      {uploadedFile != null && isPreviewOpen && (
        <DropPreviewModal
          audioFile={uploadedFile}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
}
