export const AUTOMATION_INTERPOLATIONS = ['hold', 'linear', 'exponential', 'logarithmic', 'curved'] as const;
export type AutomationInterpolation = (typeof AUTOMATION_INTERPOLATIONS)[number];

export type AutomationTarget =
  | { readonly kind: 'trackVolume' }
  | { readonly kind: 'trackPan' }
  | { readonly kind: 'sendGain'; readonly sendId: string }
  | {
      readonly kind: 'pluginParameter';
      readonly parameterId: string;
      readonly pluginInstanceId: string;
    };

export interface AutomationPointState {
  readonly id: string;
  readonly interpolation: AutomationInterpolation;
  readonly timeSeconds: number;
  readonly value: number;
}

export interface AutomationLaneState {
  readonly id: string;
  readonly isEnabled: boolean;
  readonly points: readonly AutomationPointState[];
  readonly target: AutomationTarget;
}

export function cloneAutomationLaneState(lane: AutomationLaneState): AutomationLaneState {
  return {
    id: lane.id,
    isEnabled: lane.isEnabled,
    points: lane.points.map(point => ({ ...point })),
    target: { ...lane.target },
  };
}

export function getAutomationTargetKey(target: AutomationTarget): string {
  switch (target.kind) {
    case 'trackVolume':
    case 'trackPan':
      return target.kind;
    case 'sendGain':
      return `${target.kind}:${target.sendId}`;
    case 'pluginParameter':
      return `${target.kind}:${target.pluginInstanceId}:${target.parameterId}`;
  }
}
