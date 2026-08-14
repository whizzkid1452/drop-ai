export const ROUTING_TRACK_KINDS = ['audio', 'aux', 'bus', 'folder', 'vca'] as const;
export const ROUTING_CHANNEL_COUNTS = [1, 2] as const;
export const ROUTING_SEND_TAP_POINTS = ['preFader', 'postFader'] as const;

export type RoutingTrackKind = (typeof ROUTING_TRACK_KINDS)[number];
export type RoutingChannelCount = (typeof ROUTING_CHANNEL_COUNTS)[number];
export type RoutingSendTapPoint = (typeof ROUTING_SEND_TAP_POINTS)[number];

export type RoutingRouteTarget =
  | { readonly kind: 'master' }
  | { readonly kind: 'track'; readonly trackId: string }
  | { readonly kind: 'none' };

export interface RoutingRouteState {
  readonly trackId: string;
  readonly kind: RoutingTrackKind;
  readonly channelCount: RoutingChannelCount;
  readonly output: RoutingRouteTarget;
  readonly folderId: string | null;
  readonly vcaIds: readonly string[];
}

export interface RoutingSendState {
  readonly id: string;
  readonly sourceTrackId: string;
  readonly destinationTrackId: string;
  readonly gain: number;
  readonly tapPoint: RoutingSendTapPoint;
  readonly isEnabled: boolean;
}

export interface RoutingGraphSnapshot {
  readonly routes: readonly RoutingRouteState[];
  readonly sends: readonly RoutingSendState[];
}

export function createDefaultRoutingGraphSnapshot(trackIds: readonly string[]): RoutingGraphSnapshot {
  return {
    routes: trackIds.map(trackId => ({
      channelCount: 2,
      folderId: null,
      kind: 'audio',
      output: { kind: 'master' },
      trackId,
      vcaIds: [],
    })),
    sends: [],
  };
}

export function cloneRoutingGraphSnapshot(graph: RoutingGraphSnapshot): RoutingGraphSnapshot {
  return {
    routes: graph.routes.map(route => ({
      ...route,
      output: { ...route.output },
      vcaIds: [...route.vcaIds],
    })),
    sends: graph.sends.map(send => ({ ...send })),
  };
}
