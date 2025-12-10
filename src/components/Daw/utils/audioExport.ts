import type { AudioFile } from '@/components/DropZone/components/FileUpload/components/types';
import { DEFAULT_SAMPLE_RATE } from './constants';
import type { ExportProgress } from './types';
import {
  loadAudioFile,
  decodeAudioData,
  mixAudioBuffers,
} from './audioUtils';
import { audioBufferToWav } from './wavConverter';

function updateProgress(
  onProgress: ((progress: ExportProgress) => void) | undefined,
  progress: number
): void {
  onProgress?.({
    progress: Math.max(0, Math.min(100, progress)),
  });
}

async function loadAndDecodeTracks(
  audioContext: AudioContext,
  tracks: AudioFile[],
  onProgress?: (progress: ExportProgress) => void
): Promise<AudioBuffer[]> {
  const audioBuffers: AudioBuffer[] = [];
  const totalTracks = tracks.length;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    updateProgress(onProgress, (i / totalTracks) * 50);

    try {
      const arrayBuffer = await loadAudioFile(track);
      const audioBuffer = await decodeAudioData(audioContext, arrayBuffer);
      audioBuffers.push(audioBuffer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to load track: ${track.name}`, error);
      throw new Error(`Failed to load track "${track.name}": ${errorMessage}`);
    }
  }

  return audioBuffers;
}

export async function exportTracks(
  tracks: AudioFile[],
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  if (tracks.length === 0) {
    throw new Error('No tracks to export');
  }

  const audioContext = new AudioContext({ sampleRate: DEFAULT_SAMPLE_RATE });
  updateProgress(onProgress, 0);

  try {
    const audioBuffers = await loadAndDecodeTracks(
      audioContext,
      tracks,
      onProgress
    );

    updateProgress(onProgress, 50);

    const mixedBuffer = await mixAudioBuffers(
      audioContext,
      audioBuffers,
      DEFAULT_SAMPLE_RATE
    );

    updateProgress(onProgress, 90);

    const wavBlob = audioBufferToWav(mixedBuffer);
    updateProgress(onProgress, 100);

    return wavBlob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Export failed:', error);
    throw new Error(`Export failed: ${errorMessage}`);
  } finally {
    if (audioContext.state !== 'closed') {
      await audioContext.close().catch((err) => {
        console.warn('Failed to close AudioContext:', err);
      });
    }
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}

export type { ExportProgress };
