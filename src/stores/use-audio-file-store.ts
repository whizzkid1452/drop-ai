import type { AudioFile } from '@/types/audioFile';
import { create } from 'zustand';

interface AudioFileStore {
  audioFiles: Map<string, AudioFile>;
  getAudioFile: ({ url }: { url: string }) => AudioFile | undefined;
  getAudioFiles: () => Map<string, AudioFile>;
  addAudioFile: ({
    url,
    audioFile,
  }: {
    url: string;
    audioFile: AudioFile;
  }) => void;
  removeAudioFile: ({ url }: { url: string }) => void;
}

export const useAudioFileStore = create<AudioFileStore>()((set, get) => ({
  audioFiles: new Map(),
  getAudioFiles: () => {
    return get().audioFiles;
  },
  getAudioFile: ({ url }) => {
    return get().audioFiles.get(url);
  },
  addAudioFile: ({ url, audioFile }) => {
    set(state => {
      state.audioFiles.set(url, audioFile);
      return {};
    });
  },
  removeAudioFile: ({ url }) => {
    set(state => {
      const hasExisted = state.audioFiles.delete(url);
      if (hasExisted) {
        /** @note 메모리 누수 방지를 위한 방어 코드 */
        URL.revokeObjectURL(url);
      }
      return {};
    });
  },
}));
