import { FileUpload } from './components/FileUpload/FileUpload';
import type { AudioFile } from './components/FileUpload/components/types';
import { useTracks } from '@/contexts/TrackContext';

export function DropZonePage() {
  const { addTrack } = useTracks();

  const handleFileUploaded = (file: AudioFile) => {
    console.log('File uploaded:', file);
    // 트랙 컨텍스트에 추가
    addTrack(file);
  };

  return (
    <div>
      <FileUpload onFileUploaded={handleFileUploaded} />
    </div>
  );
}