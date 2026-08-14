import { describe, expect, it, vi } from 'vitest';
import { createSessionStore, type RegionState, type TrackState } from '../session/session';
import { ProjectStateError } from './project-state-error';
import { EditorController } from './editor-controller';
import type { IEditorRegionRuntime, ReplaceEditorTrackRegionsRequest } from '../shared/types/editor-runtime';
import { createDefaultRegionProcessingState } from '../shared/types/region-processing';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';

function createRegion(overrides: Partial<RegionState> = {}): RegionState {
  return {
    ...createDefaultRegionProcessingState(),
    duration: 2,
    endTime: 6,
    id: REGION_ID,
    sourceId: '33333333-3333-4333-8333-333333333333',
    sourceStartTime: 1,
    startTime: 4,
    status: [],
    ...overrides,
  };
}

function createController() {
  const sessionStore = createSessionStore({
    initialProjectMetadata: { id: '44444444-4444-4444-8444-444444444444', name: '편집 테스트', revision: 0 },
  });
  const track: TrackState = {
    id: TRACK_ID,
    isMuted: false,
    isSoloed: false,
    name: 'Vocal',
    pan: 0,
    pluginInstances: [],
    regions: [createRegion(), createRegion({ id: '55555555-5555-4555-8555-555555555555', startTime: 8, endTime: 10 })],
    status: [],
    volume: 1,
  };
  sessionStore.getState().addTrack(track);
  const replaceTrackRegions = vi.fn(async ({ tracks }: ReplaceEditorTrackRegionsRequest) => {
    tracks.forEach(snapshot => {
      sessionStore.getState().updateTrack(snapshot.trackId, {
        regions: snapshot.regions.map(region => ({
          duration: region.durationSeconds,
          endTime: region.startTimeSeconds + region.durationSeconds,
          fadeIn: { ...region.fadeIn },
          fadeOut: { ...region.fadeOut },
          gain: region.gain,
          id: region.id,
          isOpaque: region.isOpaque,
          layer: region.layer,
          sourceId: region.sourceId,
          sourceStartTime: region.sourceStartTimeSeconds,
          startTime: region.startTimeSeconds,
          status: [],
        })),
      });
    });
  });
  const regionRuntime: IEditorRegionRuntime = { replaceTrackRegions };
  const controller = new EditorController({
    createRegionId: () => '66666666-6666-4666-8666-666666666666',
    regionRuntime,
    sessionStore,
  });
  return { controller, replaceTrackRegions, sessionStore };
}

describe('EditorController runtime 상태', () => {
  it('Track·Region·Range 선택과 edit point를 검증해 구독자에게 발행한다', () => {
    const { controller } = createController();
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.setSelection({
      editPointSeconds: 5,
      range: { endTimeSeconds: 7, startTimeSeconds: 3, trackIds: [TRACK_ID] },
      regions: [{ regionId: REGION_ID, trackId: TRACK_ID }],
      trackIds: [TRACK_ID],
    });

    expect(controller.getState().selection).toEqual({
      editPointSeconds: 5,
      range: { endTimeSeconds: 7, startTimeSeconds: 3, trackIds: [TRACK_ID] },
      regions: [{ regionId: REGION_ID, trackId: TRACK_ID }],
      trackIds: [TRACK_ID],
    });
    expect(listener).toHaveBeenCalledOnce();
  });

  it('존재하지 않는 Region 선택은 명시적 상태 오류로 거부한다', () => {
    const { controller } = createController();

    expect(() =>
      controller.setSelection({
        editPointSeconds: 0,
        range: null,
        regions: [{ regionId: '66666666-6666-4666-8666-666666666666', trackId: TRACK_ID }],
        trackIds: [],
      })
    ).toThrow(ProjectStateError);
  });

  it('선택 Region을 상대 위치 Clipboard snapshot으로 복사한다', () => {
    const { controller } = createController();
    controller.setSelection({
      editPointSeconds: 4,
      range: null,
      regions: [
        { regionId: REGION_ID, trackId: TRACK_ID },
        { regionId: '55555555-5555-4555-8555-555555555555', trackId: TRACK_ID },
      ],
      trackIds: [TRACK_ID],
    });

    controller.copySelectedRegions();

    expect(controller.getState().clipboard).toEqual({
      entries: [
        {
          ...createDefaultRegionProcessingState(),
          durationSeconds: 2,
          relativeStartTimeSeconds: 0,
          sourceId: '33333333-3333-4333-8333-333333333333',
          sourceStartTimeSeconds: 1,
          sourceTrackId: TRACK_ID,
        },
        {
          ...createDefaultRegionProcessingState(),
          durationSeconds: 2,
          relativeStartTimeSeconds: 4,
          sourceId: '33333333-3333-4333-8333-333333333333',
          sourceStartTimeSeconds: 1,
          sourceTrackId: TRACK_ID,
        },
      ],
      pasteCount: 0,
    });
  });

  it('reset은 저장 대상과 무관한 선택과 Clipboard를 함께 비운다', () => {
    const { controller } = createController();
    controller.setSelection({
      editPointSeconds: 4,
      range: null,
      regions: [{ regionId: REGION_ID, trackId: TRACK_ID }],
      trackIds: [TRACK_ID],
    });
    controller.copySelectedRegions();

    controller.reset();

    expect(controller.getState()).toEqual({
      clipboard: { entries: [], pasteCount: 0 },
      selection: { editPointSeconds: 0, range: null, regions: [], trackIds: [] },
    });
  });
});

describe('EditorController Region 편집', () => {
  it('cut은 교체 성공 뒤 Clipboard를 만들고 선택 Region을 제거한다', async () => {
    const { controller, replaceTrackRegions } = createController();
    controller.setSelection({
      editPointSeconds: 4,
      range: null,
      regions: [{ regionId: REGION_ID, trackId: TRACK_ID }],
      trackIds: [TRACK_ID],
    });

    await controller.cutSelectedRegions();

    expect(replaceTrackRegions).toHaveBeenCalledWith({
      tracks: [
        {
          regions: [
            {
              ...createDefaultRegionProcessingState(),
              durationSeconds: 2,
              id: '55555555-5555-4555-8555-555555555555',
              sourceId: '33333333-3333-4333-8333-333333333333',
              sourceStartTimeSeconds: 1,
              startTimeSeconds: 8,
            },
          ],
          trackId: TRACK_ID,
        },
      ],
    });
    expect(controller.getState().clipboard.entries).toHaveLength(1);
    expect(controller.getState().selection.regions).toEqual([]);
  });

  it('cut 교체 실패 시 기존 Clipboard와 선택을 유지한다', async () => {
    const { controller, replaceTrackRegions } = createController();
    controller.setSelection({
      editPointSeconds: 4,
      range: null,
      regions: [{ regionId: REGION_ID, trackId: TRACK_ID }],
      trackIds: [TRACK_ID],
    });
    replaceTrackRegions.mockRejectedValueOnce(new Error('교체 실패'));

    await expect(controller.cutSelectedRegions()).rejects.toThrow('교체 실패');
    expect(controller.getState().clipboard.entries).toEqual([]);
    expect(controller.getState().selection.regions).toEqual([{ regionId: REGION_ID, trackId: TRACK_ID }]);
  });

  it('paste는 선택된 단일 Track의 edit point에 Clipboard 상대 위치를 유지한다', async () => {
    const { controller, replaceTrackRegions } = createController();
    controller.setSelection({
      editPointSeconds: 4,
      range: null,
      regions: [{ regionId: REGION_ID, trackId: TRACK_ID }],
      trackIds: [TRACK_ID],
    });
    controller.copySelectedRegions();
    controller.setSelection({ editPointSeconds: 12, range: null, regions: [], trackIds: [TRACK_ID] });

    await controller.pasteRegions();

    expect(replaceTrackRegions.mock.calls[0]?.[0].tracks[0]?.regions.at(-1)).toEqual({
      ...createDefaultRegionProcessingState(),
      durationSeconds: 2,
      id: '66666666-6666-4666-8666-666666666666',
      sourceId: '33333333-3333-4333-8333-333333333333',
      sourceStartTimeSeconds: 1,
      startTimeSeconds: 12,
    });
    expect(controller.getState().clipboard.pasteCount).toBe(1);
    expect(controller.getState().selection.regions).toEqual([
      { regionId: '66666666-6666-4666-8666-666666666666', trackId: TRACK_ID },
    ]);
  });

  it('nudge는 선택 Region의 상대 간격을 유지하며 음수 시작 위치를 거부한다', async () => {
    const { controller, replaceTrackRegions } = createController();
    controller.setSelection({
      editPointSeconds: 4,
      range: null,
      regions: [
        { regionId: REGION_ID, trackId: TRACK_ID },
        { regionId: '55555555-5555-4555-8555-555555555555', trackId: TRACK_ID },
      ],
      trackIds: [TRACK_ID],
    });

    await controller.nudgeSelectedRegions(-1);

    expect(replaceTrackRegions.mock.calls[0]?.[0].tracks[0]?.regions.map(region => region.startTimeSeconds)).toEqual([
      3, 7,
    ]);
    await expect(controller.nudgeSelectedRegions(-4)).rejects.toThrow(ProjectStateError);
  });

  it('trim과 slip은 timeline 범위와 Source 범위를 각각 명시적으로 변경한다', async () => {
    const { controller, replaceTrackRegions } = createController();

    await controller.trimRegion({
      durationSeconds: 1.5,
      regionId: REGION_ID,
      sourceStartTimeSeconds: 1.5,
      startTimeSeconds: 4.5,
      trackId: TRACK_ID,
    });
    await controller.slipRegion({ regionId: REGION_ID, sourceStartTimeSeconds: 2, trackId: TRACK_ID });

    expect(replaceTrackRegions.mock.calls[0]?.[0].tracks[0]?.regions[0]).toMatchObject({
      durationSeconds: 1.5,
      sourceStartTimeSeconds: 1.5,
      startTimeSeconds: 4.5,
    });
    expect(replaceTrackRegions.mock.calls[1]?.[0].tracks[0]?.regions[0]).toMatchObject({
      durationSeconds: 1.5,
      sourceStartTimeSeconds: 2,
      startTimeSeconds: 4.5,
    });
  });
});
