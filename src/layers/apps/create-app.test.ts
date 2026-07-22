import { describe, expect, it } from 'vitest';
import { CommandExecutor } from '../commands/command-executor';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { createApp } from './create-app';

describe('createApp', () => {
  it('하나의 CommandExecutor를 조립한다', () => {
    const app = createApp({ audioEngine: new MockAudioEngine() });

    expect(app.commandExecutor).toBeInstanceOf(CommandExecutor);
  });
});
