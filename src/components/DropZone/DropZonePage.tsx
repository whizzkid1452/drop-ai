import { FileUpload } from './components/FileUpload/FileUpload';
import type { AudioFile } from './components/FileUpload/components/types';
import { useTracks } from '@/contexts/TrackContext';

export function DropZonePage() {
  const { addTrack } = useTracks();

  const handleFileUploaded = (file: AudioFile) => {
    addTrack(file);
  };

  return (
    <div>
      <FileUpload onFileUploaded={handleFileUploaded} />
    </div>
  );
}