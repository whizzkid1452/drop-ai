import type { BaseContext } from 'tone';

export async function loadAndDecodeAudioBuffer({
  audioContext,
  audioUrl,
}: {
  audioContext: BaseContext;
  audioUrl: string;
}) {
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer;
}
