import type { ProjectBwfMetadata } from '../../types/project-document.schema';

export const AUDIO_CODECS = ['wav', 'flac', 'mp3', 'ogg', 'webm', 'aac', 'm4a', 'unknown'] as const;
export type AudioCodec = (typeof AUDIO_CODECS)[number];

export interface AudioCodecSupport {
  readonly codec: Exclude<AudioCodec, 'unknown'>;
  readonly isSupported: boolean;
  readonly mimeTypes: readonly string[];
  readonly supportLevel: CanPlayTypeResult;
}

interface DetectAudioCodecRequest {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly mimeType: string;
}

interface ReadBrowserAudioCodecSupportRequest {
  readonly canPlayType: (mimeType: string) => CanPlayTypeResult;
}

const CODEC_MIME_TYPES: ReadonlyArray<{
  readonly codec: Exclude<AudioCodec, 'unknown'>;
  readonly mimeTypes: readonly string[];
}> = [
  { codec: 'wav', mimeTypes: ['audio/wav', 'audio/wave', 'audio/x-wav'] },
  { codec: 'flac', mimeTypes: ['audio/flac'] },
  { codec: 'mp3', mimeTypes: ['audio/mpeg'] },
  { codec: 'ogg', mimeTypes: ['audio/ogg; codecs=opus', 'audio/ogg; codecs=vorbis', 'audio/ogg'] },
  { codec: 'webm', mimeTypes: ['audio/webm; codecs=opus', 'audio/webm'] },
  { codec: 'aac', mimeTypes: ['audio/aac'] },
  { codec: 'm4a', mimeTypes: ['audio/mp4; codecs=mp4a.40.2', 'audio/mp4'] },
];

function hasAscii(bytes: Uint8Array, offset: number, value: string): boolean {
  if (offset + value.length > bytes.length) {
    return false;
  }
  return value.split('').every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

function inferCodecFromText(fileName: string, mimeType: string): AudioCodec {
  const normalizedMimeType = mimeType.toLocaleLowerCase();
  const extension = fileName.split('.').pop()?.toLocaleLowerCase() ?? '';
  if (normalizedMimeType.includes('wav') || normalizedMimeType.includes('wave') || extension === 'wav') return 'wav';
  if (normalizedMimeType.includes('flac') || extension === 'flac') return 'flac';
  if (normalizedMimeType.includes('mpeg') || extension === 'mp3') return 'mp3';
  if (normalizedMimeType.includes('ogg') || extension === 'ogg' || extension === 'oga') return 'ogg';
  if (normalizedMimeType.includes('webm') || extension === 'webm') return 'webm';
  if (normalizedMimeType.includes('aac') || extension === 'aac') return 'aac';
  if (normalizedMimeType.includes('mp4') || extension === 'm4a' || extension === 'mp4') return 'm4a';
  return 'unknown';
}

export function detectAudioCodec({ bytes, fileName, mimeType }: DetectAudioCodecRequest): AudioCodec {
  if (hasAscii(bytes, 0, 'RIFF') && hasAscii(bytes, 8, 'WAVE')) return 'wav';
  if (hasAscii(bytes, 0, 'fLaC')) return 'flac';
  if (hasAscii(bytes, 0, 'ID3') || (bytes[0] === 0xff && (bytes[1] ?? 0) >= 0xe0)) return 'mp3';
  if (hasAscii(bytes, 0, 'OggS')) return 'ogg';
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
  if (hasAscii(bytes, 4, 'ftyp')) return 'm4a';
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xf6) === 0xf0) return 'aac';
  return inferCodecFromText(fileName, mimeType);
}

function readAscii(view: DataView, offset: number, length: number): string {
  const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
  const end = bytes.indexOf(0);
  const textBytes = end >= 0 ? bytes.subarray(0, end) : bytes;
  return new TextDecoder('ascii').decode(textBytes).trim();
}

function findRiffChunk(view: DataView, chunkId: string): { readonly dataOffset: number; readonly size: number } | null {
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const size = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    if (hasAscii(new Uint8Array(view.buffer, view.byteOffset, view.byteLength), offset, chunkId)) {
      return dataOffset + size <= view.byteLength ? { dataOffset, size } : null;
    }
    offset = dataOffset + size + (size % 2);
  }
  return null;
}

export function parseBroadcastWaveMetadata(buffer: ArrayBuffer): ProjectBwfMetadata | null {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  if (view.byteLength < 12 || !hasAscii(bytes, 0, 'RIFF') || !hasAscii(bytes, 8, 'WAVE')) {
    return null;
  }
  const chunk = findRiffChunk(view, 'bext');
  if (!chunk || chunk.size < 602) {
    return null;
  }
  const lowTimeReference = view.getUint32(chunk.dataOffset + 338, true);
  const highTimeReference = view.getUint32(chunk.dataOffset + 342, true);
  const timeReferenceSamples = highTimeReference * 2 ** 32 + lowTimeReference;
  if (!Number.isSafeInteger(timeReferenceSamples)) {
    return null;
  }
  return {
    codingHistory: readAscii(view, chunk.dataOffset + 602, chunk.size - 602),
    description: readAscii(view, chunk.dataOffset, 256),
    originationDate: readAscii(view, chunk.dataOffset + 320, 10),
    originationTime: readAscii(view, chunk.dataOffset + 330, 8),
    originator: readAscii(view, chunk.dataOffset + 256, 32),
    originatorReference: readAscii(view, chunk.dataOffset + 288, 32),
    timeReferenceSamples,
  };
}

function chooseSupportLevel(levels: readonly CanPlayTypeResult[]): CanPlayTypeResult {
  if (levels.includes('probably')) return 'probably';
  if (levels.includes('maybe')) return 'maybe';
  return '';
}

export function readBrowserAudioCodecSupport({
  canPlayType,
}: ReadBrowserAudioCodecSupportRequest): readonly AudioCodecSupport[] {
  return CODEC_MIME_TYPES.map(({ codec, mimeTypes }) => {
    const supportLevel = chooseSupportLevel(mimeTypes.map(mimeType => canPlayType(mimeType)));
    return { codec, isSupported: supportLevel !== '', mimeTypes, supportLevel };
  });
}
