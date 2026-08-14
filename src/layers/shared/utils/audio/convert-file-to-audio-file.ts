import type { AudioFile } from '../../types/audioFile';
import { getFileDuration } from './get-audio-metadata';
import { formatDuration } from '@/utils/audio/formatDuration';
import { formatFileSize } from '@/utils/audio/formatFileSize';
import { detectAudioCodec, parseBroadcastWaveMetadata } from './audio-source-file-metadata';

const MAX_SOURCE_METADATA_BYTES = 128 * 1024;

export type AudioFileMetadata = AudioFile;

export async function convertFileToAudioFile(file: File): Promise<AudioFileMetadata | null> {
  try {
    let duration: number | undefined;
    const metadataBuffer = await file.slice(0, MAX_SOURCE_METADATA_BYTES).arrayBuffer();
    const detectedCodec = detectAudioCodec({
      bytes: new Uint8Array(metadataBuffer),
      fileName: file.name,
      mimeType: file.type,
    });
    const bwfMetadata = detectedCodec === 'wav' ? parseBroadcastWaveMetadata(metadataBuffer) : null;

    try {
      duration = await getFileDuration(file);
    } catch (err) {
      console.warn('Unable to get file duration:', err);
    }

    return {
      file,
      name: file.name,
      size: file.size,
      formattedSize: formatFileSize(file.size),
      type: file.type,
      duration,
      formattedDuration: duration ? formatDuration(duration) : undefined,
      volume: 1,
      bwfMetadata,
      detectedCodec,
    };
  } catch (err) {
    console.error(err);
    return null;
  }
}
