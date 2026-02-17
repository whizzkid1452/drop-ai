/**
 * Encodes an AudioBuffer to a WAV Pulse-Code Modulation (PCM) Blob.
 * Currently uses 32-bit float format for simplicity and high quality.
 */
export function encodeWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 3; // IEEE Float
  const bitDepth = 32;

  let resultHelper: Float32Array;

  // Interleave channels
  if (numChannels === 2) {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    const length = left.length + right.length;
    resultHelper = new Float32Array(length);
    for (let i = 0; i < left.length; i++) {
      resultHelper[i * 2] = left[i];
      resultHelper[i * 2 + 1] = right[i];
    }
  } else {
    // Mono
    resultHelper = audioBuffer.getChannelData(0);
  }

  const bufferLength = resultHelper.length * 4; // 4 bytes per float
  const wavHeaderLength = 44;
  const fileLength = wavHeaderLength + bufferLength;

  const buffer = new ArrayBuffer(fileLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + bufferLength, true); // File size - 8
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true); // AudioFormat (3 = Float)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 4, true); // ByteRate
  view.setUint16(32, numChannels * 4, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, bufferLength, true);

  // Write PCM samples
  const floatView = new Float32Array(buffer, 44);
  floatView.set(resultHelper);

  return new Blob([buffer], { type: 'audio/wav' });
}
