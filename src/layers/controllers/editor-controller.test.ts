import { describe, expect, it, vi } from 'vitest';
import { createSessionStore, type RegionState, type TrackState } from '../session/session';
import { ProjectStateError } from './project-state-error';
import { EditorController } from './editor-controller';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const REGION_ID = '22222222-2222-4222-8222-222222222222';

function createRegion(overrides: Partial<RegionState> = {}): RegionState {
  return {
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
  return { controller: new EditorController(sessionStore), sessionStore };
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
          durationSeconds: 2,
          relativeStartTimeSeconds: 0,
          sourceId: '33333333-3333-4333-8333-333333333333',
          sourceStartTimeSeconds: 1,
          sourceTrackId: TRACK_ID,
        },
        {
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
