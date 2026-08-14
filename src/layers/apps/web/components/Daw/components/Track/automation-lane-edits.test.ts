import { describe, expect, it } from 'vitest';
import type { AutomationLaneState } from '@/layers/shared/types/automation-state';
import {
  addAutomationPoint,
  copyAutomationPoints,
  deleteAutomationPoints,
  eraseAutomationRange,
  moveAutomationPoint,
  pasteAutomationPoints,
} from './automation-lane-edits';

const LANE: AutomationLaneState = {
  id: '11111111-1111-4111-8111-111111111111',
  isEnabled: true,
  mode: 'read',
  points: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      interpolation: 'linear',
      timeSeconds: 1,
      value: 0.25,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      interpolation: 'hold',
      timeSeconds: 3,
      value: 0.75,
    },
  ],
  target: { kind: 'trackVolume' },
};

describe('Automation lane 편집', () => {
  it('새 점을 시간순으로 추가한다', () => {
    const result = addAutomationPoint({
      lane: LANE,
      point: {
        id: '44444444-4444-4444-8444-444444444444',
        interpolation: 'linear',
        timeSeconds: 2,
        value: 0.5,
      },
    });

    expect(result.points.map(point => point.timeSeconds)).toEqual([1, 2, 3]);
  });

  it('같은 시간의 점을 추가하면 기존 점의 값과 보간만 바꾼다', () => {
    const result = addAutomationPoint({
      lane: LANE,
      point: {
        id: '44444444-4444-4444-8444-444444444444',
        interpolation: 'curved',
        timeSeconds: 1,
        value: 0.6,
      },
    });

    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toEqual({ ...LANE.points[0], interpolation: 'curved', value: 0.6 });
  });

  it('이동한 점을 값 범위와 이웃 점 사이로 제한한다', () => {
    const result = moveAutomationPoint({
      lane: LANE,
      pointId: LANE.points[0].id,
      timeSeconds: 5,
      value: -1,
    });

    expect(result.points[0].timeSeconds).toBeCloseTo(2.999, 6);
    expect(result.points[0].value).toBe(0);
  });

  it('선택한 점만 삭제한다', () => {
    const result = deleteAutomationPoints({ lane: LANE, pointIds: new Set([LANE.points[0].id]) });

    expect(result.points).toEqual([LANE.points[1]]);
  });

  it('선택한 점을 상대 시간 Clipboard로 복사하고 기준 시간에 붙여넣는다', () => {
    const clipboard = copyAutomationPoints({ lane: LANE, pointIds: new Set(LANE.points.map(point => point.id)) });
    const ids = ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'];
    const result = pasteAutomationPoints({
      clipboard,
      createId: () => ids.shift() ?? '',
      lane: LANE,
      startTimeSeconds: 5,
    });

    expect(result.points.slice(-2)).toEqual([
      { ...LANE.points[0], id: '44444444-4444-4444-8444-444444444444', timeSeconds: 5 },
      { ...LANE.points[1], id: '55555555-5555-4555-8555-555555555555', timeSeconds: 7 },
    ]);
  });

  it('Range 안의 점만 지운다', () => {
    const result = eraseAutomationRange({ endTimeSeconds: 2, lane: LANE, startTimeSeconds: 0.5 });

    expect(result.points).toEqual([LANE.points[1]]);
  });
});
