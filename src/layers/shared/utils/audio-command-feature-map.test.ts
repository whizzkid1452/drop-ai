import { describe, expect, it } from 'vitest';
import { AudioCommandType } from '../types/audioCommand.schema';
import { getAudioCommandFeatureRequirement } from './audio-command-feature-map';
import { AudioRuntimeFeature } from './audio-runtime-capabilities';

describe('getAudioCommandFeatureRequirement', () => {
  it('저장과 Undo는 runtime 기능 검사 없이 허용한다', () => {
    expect(getAudioCommandFeatureRequirement(AudioCommandType.SAVE_PROJECT)).toBeNull();
    expect(getAudioCommandFeatureRequirement(AudioCommandType.UNDO)).toBeNull();
  });

  it('녹음과 MIDI 명령은 해당 runtime 기능을 요구한다', () => {
    expect(getAudioCommandFeatureRequirement(AudioCommandType.START_RECORDING)).toBe(
      AudioRuntimeFeature.LINEAR_RECORDING
    );
    expect(getAudioCommandFeatureRequirement(AudioCommandType.ADD_MIDI_TRACK)).toBe(AudioRuntimeFeature.MIDI);
  });
});
