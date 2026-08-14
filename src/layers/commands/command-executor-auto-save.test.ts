import { describe, expect, it } from 'vitest';
import { createApp } from '../apps/create-app';
import { MockAudioEngine } from '../audio-engine/mock-audio-engine';
import { InMemoryProjectRepository } from '../project-repository/in-memory-project-repository';
import { AudioCommandType } from '../shared/types/audioCommand.schema';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const TRACK_ID = '22222222-2222-4222-8222-222222222222';

function createTestApp() {
  const projectRepository = new InMemoryProjectRepository({ now: () => 1_000 });
  const app = createApp({
    audioEngine: new MockAudioEngine(),
    initialProjectMetadata: { id: PROJECT_ID, name: '새 프로젝트', revision: 0 },
    projectRepository,
  });
  return { app, projectRepository };
}

describe('CommandExecutor 로컬 자동 저장', () => {
  it('프로젝트 변경 명령이 끝나면 문서와 Outbox 변경을 저장한다', async () => {
    const { app, projectRepository } = createTestApp();

    await app.commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });

    await expect(projectRepository.load(PROJECT_ID)).resolves.toMatchObject({
      project: { id: PROJECT_ID, revision: 0 },
      tracks: [{ id: TRACK_ID }],
    });
    await expect(projectRepository.listPendingChanges({ dueAtEpochMilliseconds: 1_000 })).resolves.toEqual([
      expect.objectContaining({ projectId: PROJECT_ID, localRevision: 0 }),
    ]);
  });

  it('재생처럼 프로젝트 문서를 바꾸지 않는 명령은 Outbox에 추가하지 않는다', async () => {
    const { app, projectRepository } = createTestApp();

    await app.commandExecutor.execute({ type: AudioCommandType.PLAY });

    await expect(projectRepository.listPendingChanges({ dueAtEpochMilliseconds: 1_000 })).resolves.toEqual([]);
  });

  it('Automation write preview는 Session과 Outbox를 변경하지 않는다', async () => {
    const { app, projectRepository } = createTestApp();
    const laneId = '33333333-3333-4333-8333-333333333333';
    await app.commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });
    await app.commandExecutor.execute({
      automationLanes: [
        {
          id: laneId,
          isEnabled: true,
          mode: 'touch',
          points: [],
          target: { kind: 'trackVolume' },
        },
      ],
      trackId: TRACK_ID,
      type: AudioCommandType.SET_AUTOMATION_LANES,
    });
    const beforeChanges = await projectRepository.listPendingChanges({ dueAtEpochMilliseconds: 1_000 });

    await app.commandExecutor.execute({
      laneId,
      passRange: { endTimeSeconds: 2, startTimeSeconds: 1 },
      samples: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          interpolation: 'linear',
          timeSeconds: 1.5,
          value: 0.5,
        },
      ],
      trackId: TRACK_ID,
      type: AudioCommandType.PREVIEW_AUTOMATION_WRITE_PASS,
    });

    await expect(projectRepository.listPendingChanges({ dueAtEpochMilliseconds: 1_000 })).resolves.toEqual(
      beforeChanges
    );
    await expect(projectRepository.load(PROJECT_ID)).resolves.toMatchObject({
      tracks: [{ automationLanes: [{ points: [] }] }],
    });
  });

  it('연속 프로젝트 변경은 revision 순서대로 각각 저장한다', async () => {
    const { app, projectRepository } = createTestApp();
    await app.commandExecutor.execute({ type: AudioCommandType.ADD_TRACK, trackId: TRACK_ID });

    await app.commandExecutor.execute({ type: AudioCommandType.SET_TRACK_NAME, trackId: TRACK_ID, name: '보컬' });

    await expect(projectRepository.load(PROJECT_ID)).resolves.toMatchObject({
      project: { revision: 1 },
      tracks: [{ id: TRACK_ID, name: '보컬' }],
    });
    await expect(projectRepository.listPendingChanges({ dueAtEpochMilliseconds: 1_000 })).resolves.toEqual([
      expect.objectContaining({ localRevision: 0 }),
      expect.objectContaining({ localRevision: 1 }),
    ]);
  });

  it('Timeline Marker 변경을 현재 문서 버전에 자동 저장한다', async () => {
    const { app, projectRepository } = createTestApp();
    const marker = {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Verse',
      quarterNotePosition: 8,
    };

    await app.commandExecutor.execute({ type: AudioCommandType.SET_TIMELINE_MARKERS, markers: [marker] });

    await expect(projectRepository.load(PROJECT_ID)).resolves.toMatchObject({
      schemaVersion: 14,
      timeline: { markers: [marker] },
    });
  });
});
