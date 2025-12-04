import { FileUpload } from './components/FileUpload/FileUpload';
import type { AudioFile } from './components/FileUpload/components/types';

export function DropZonePage() {
  const handleFileUploaded = (file: AudioFile) => {
    console.log('File uploaded:', file);
    // TODO: 파일 업로드 후 처리 로직 추가
  };

  return (
    <div>
      <FileUpload onFileUploaded={handleFileUploaded} />
    </div>
  );
}