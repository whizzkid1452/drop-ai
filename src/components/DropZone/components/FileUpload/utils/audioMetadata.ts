import { ERROR_MESSAGES } from '../components/constants';

export function getFileDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    audio.addEventListener('loadedmetadata', () => {
      cleanup();
      resolve(audio.duration);
    });

    audio.addEventListener('error', () => {
      cleanup();
      reject(new Error(ERROR_MESSAGES.FILE_READ_ERROR));
    });

    audio.src = url;
  });
}
