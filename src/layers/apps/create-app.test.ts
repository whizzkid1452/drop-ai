import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSourceRegistry } from '../audio-source-registry/audio-source-registry';
import type { IObjectUrlAdapter } from '../audio-source-registry/i-object-url-adapter';
import { CommandExecutor } from '../commands/command-executor';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { PlaybackClockQuery } from '../queries/playback-clock-query';
import { AudioCommandType } from '../shared/types/audioCommand.schema';
import { createApp, createCliTestApp } from './create-app';

describe('createApp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('주입한 Source Registry를 등록·조회 전용 계약으로만 노출한다', () => {
    const objectUrlAdapter: IObjectUrlAdapter = {
      createObjectUrl: vi.fn(() => 'blob:test-source'),
      revokeObjectUrl: vi.fn(),
    };
    const audioSourceRegistry = new AudioSourceRegistry(objectUrlAdapter);

    const app = createApp({ audioEngine: new MockAudioEngine(), audioSourceRegistry });

    const registration = {
      metadata: {
        id: '11111111-1111-4111-8111-111111111111',
        fileName: 'source.wav',
        mimeType: 'audio/wav',
        byteLength: 4,
        durationSeconds: 1,
      },
      blob: new Blob(['test'], { type: 'audio/wav' }),
    };
    const stagedSource = app.audioSourceStager.stage(registration);

    expect(app.audioSourceResolver.resolve(registration.metadata.id)).toEqual(stagedSource);
    expect('audioSourceRegistry' in app).toBe(false);
    expect('attach' in app.audioSourceStager).toBe(false);
    expect('stage' in app.audioSourceResolver).toBe(false);
  });

  it('기본 Source Registry 조립만으로 Object URL을 만들지 않는다', () => {
    const createObjectUrl = vi.spyOn(globalThis.URL, 'createObjectURL');

    createApp({ audioEngine: new MockAudioEngine() });

    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it('새 프로젝트 metadata를 UUID와 revision 0으로 만든다', () => {
    const app = createApp({ audioEngine: new MockAudioEngine() });

    expect(app.session.getState().project).toMatchObject({
      name: '새 프로젝트',
      revision: 0,
    });
    expect(app.session.getState().project.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('주입한 프로젝트 metadata로 Session을 조립한다', () => {
    const initialProjectMetadata = {
      id: '11111111-1111-4111-8111-111111111111',
      name: '불러온 프로젝트',
      revision: 4,
    };

    const app = createApp({ audioEngine: new MockAudioEngine(), initialProjectMetadata });

    expect(app.session.getState().project).toEqual(initialProjectMetadata);
  });

  it('하나의 CommandExecutor를 조립한다', () => {
    const app = createApp({ audioEngine: new MockAudioEngine() });

    expect(app.commandExecutor).toBeInstanceOf(CommandExecutor);
  });

  it('Controller를 노출하지 않고 읽기 전용 PlaybackClock을 조립한다', () => {
    const audioEngine = new MockAudioEngine();
    audioEngine.setTime(7.5);

    const app = createApp({ audioEngine });

    expect(app.playbackClock).toBeInstanceOf(PlaybackClockQuery);
    expect(app.playbackClock.getCurrentTime()).toBe(7.5);
    expect('controller' in app).toBe(false);
  });

  it('CLI 테스트용 AudioEngine도 Composition Root에서 조립한다', async () => {
    const app = createCliTestApp();

    await app.commandExecutor.execute({ type: AudioCommandType.PLAY });

    expect(app.session.getState().isPlaying).toBe(true);
  });

  it('브라우저 오디오 환경을 읽기 전용 capability로 조립한다', () => {
    const app = createApp({
      audioEngine: new MockAudioEngine(),
      audioRuntimeEnvironment: {
        crossOriginIsolated: false,
        hasAudioWorklet: true,
        hasSharedArrayBuffer: false,
        hasWebAssembly: true,
        isSecureContext: true,
      },
    });

    expect(app.audioRuntimeCapabilities).toMatchObject({
      meetsAudioWorkletPreconditions: true,
      meetsSharedMemoryPreconditions: false,
      meetsWasmPreconditions: true,
    });
  });
});
