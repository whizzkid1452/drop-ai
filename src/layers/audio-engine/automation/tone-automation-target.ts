import type { IAutomationAudioTarget } from './automation-param-scheduler';

interface ToneAutomationParam {
  cancelScheduledValues(time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  setValueAtTime(value: number, time: number): unknown;
  setValueCurveAtTime(values: number[], startTime: number, duration: number): unknown;
}

export function createMappedAutomationTarget({
  baseValue,
  mapValue = value => value,
  parameter,
}: {
  readonly baseValue: () => number;
  readonly mapValue?: (normalizedValue: number) => number;
  readonly parameter: ToneAutomationParam;
}): IAutomationAudioTarget {
  return {
    cancelScheduledValues: timeSeconds => {
      parameter.cancelScheduledValues(timeSeconds);
    },
    linearRampToValueAtTime: (value, timeSeconds) => {
      parameter.linearRampToValueAtTime(mapValue(value), timeSeconds);
    },
    restoreBaseValue: timeSeconds => {
      parameter.setValueAtTime(baseValue(), timeSeconds);
    },
    setValueAtTime: (value, timeSeconds) => {
      parameter.setValueAtTime(mapValue(value), timeSeconds);
    },
    setValueCurveAtTime: (values, timeSeconds, durationSeconds) => {
      parameter.setValueCurveAtTime(values.map(mapValue), timeSeconds, durationSeconds);
    },
  };
}
