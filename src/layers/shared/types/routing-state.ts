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

export interface MutableRoutingRouteState extends Omit<RoutingRouteState, 'vcaIds'> {
  readonly vcaIds: string[];
}

export interface MutableRoutingGraphSnapshot {
  readonly routes: MutableRoutingRouteState[];
  readonly sends: RoutingSendState[];
}

export class RoutingGraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutingGraphValidationError';
  }
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

export function cloneRoutingGraphSnapshot(graph: RoutingGraphSnapshot): MutableRoutingGraphSnapshot {
  return {
    routes: graph.routes.map(route => ({
      ...route,
      output: { ...route.output },
      vcaIds: [...route.vcaIds],
    })),
    sends: graph.sends.map(send => ({ ...send })),
  };
}

export function removeTrackFromRoutingGraph(graph: RoutingGraphSnapshot, trackId: string): RoutingGraphSnapshot {
  return {
    routes: graph.routes
      .filter(route => route.trackId !== trackId)
      .map(route => ({
        ...route,
        folderId: route.folderId === trackId ? null : route.folderId,
        output: route.output.kind === 'track' && route.output.trackId === trackId ? { kind: 'master' } : route.output,
        vcaIds: route.vcaIds.filter(vcaId => vcaId !== trackId),
      })),
    sends: graph.sends.filter(send => send.sourceTrackId !== trackId && send.destinationTrackId !== trackId),
  };
}

export function assertValidRoutingGraphSnapshot(graph: RoutingGraphSnapshot, trackIds: readonly string[]): void {
  const expectedTrackIds = new Set(trackIds);
  const routes = new Map<string, RoutingRouteState>();
  graph.routes.forEach(route => {
    if (routes.has(route.trackId)) {
      throw new RoutingGraphValidationError(`Track Route가 중복됐습니다: ${route.trackId}`);
    }
    if (!expectedTrackIds.has(route.trackId)) {
      throw new RoutingGraphValidationError(`Route가 존재하지 않는 Track을 참조합니다: ${route.trackId}`);
    }
    routes.set(route.trackId, route);
  });
  trackIds.forEach(trackId => {
    if (!routes.has(trackId)) {
      throw new RoutingGraphValidationError(`Track에 Route가 없습니다: ${trackId}`);
    }
  });

  const signalEdges: Array<readonly [string, string]> = [];
  const folderEdges: Array<readonly [string, string]> = [];
  graph.routes.forEach(route => {
    const isSignalRoute = route.kind === 'audio' || route.kind === 'aux' || route.kind === 'bus';
    if (isSignalRoute === (route.output.kind === 'none')) {
      throw new RoutingGraphValidationError(
        isSignalRoute ? 'Audio·Aux·Bus Track에는 출력이 필요합니다.' : 'Folder·VCA Track에는 출력을 연결할 수 없습니다.'
      );
    }
    if (route.output.kind === 'track') {
      const destination = routes.get(route.output.trackId);
      if (!destination || (destination.kind !== 'aux' && destination.kind !== 'bus')) {
        throw new RoutingGraphValidationError(`출력 대상은 Aux 또는 Bus Track이어야 합니다: ${route.output.trackId}`);
      }
      signalEdges.push([route.trackId, route.output.trackId]);
    }
    if (route.folderId !== null) {
      if (routes.get(route.folderId)?.kind !== 'folder') {
        throw new RoutingGraphValidationError(`Folder 할당 대상이 Folder Track이 아닙니다: ${route.folderId}`);
      }
      folderEdges.push([route.trackId, route.folderId]);
    }
    const vcaIds = new Set<string>();
    route.vcaIds.forEach(vcaId => {
      if (vcaIds.has(vcaId)) {
        throw new RoutingGraphValidationError(`VCA 할당이 중복됐습니다: ${vcaId}`);
      }
      if (routes.get(vcaId)?.kind !== 'vca') {
        throw new RoutingGraphValidationError(`VCA 할당 대상이 VCA Track이 아닙니다: ${vcaId}`);
      }
      vcaIds.add(vcaId);
    });
  });

  const sendIds = new Set<string>();
  graph.sends.forEach(send => {
    if (sendIds.has(send.id)) {
      throw new RoutingGraphValidationError(`Send ID가 중복됐습니다: ${send.id}`);
    }
    sendIds.add(send.id);
    const source = routes.get(send.sourceTrackId);
    const destination = routes.get(send.destinationTrackId);
    if (!source || (source.kind !== 'audio' && source.kind !== 'aux' && source.kind !== 'bus')) {
      throw new RoutingGraphValidationError(`Send 출발점이 Audio·Aux·Bus Track이 아닙니다: ${send.sourceTrackId}`);
    }
    if (!destination || (destination.kind !== 'aux' && destination.kind !== 'bus')) {
      throw new RoutingGraphValidationError(`Send 도착점이 Aux 또는 Bus Track이 아닙니다: ${send.destinationTrackId}`);
    }
    if (send.isEnabled) {
      signalEdges.push([send.sourceTrackId, send.destinationTrackId]);
    }
  });

  if (hasDirectedCycle(trackIds, signalEdges)) {
    throw new RoutingGraphValidationError('활성 신호 Route에 순환 연결이 있습니다.');
  }
  if (hasDirectedCycle(trackIds, folderEdges)) {
    throw new RoutingGraphValidationError('Folder 계층에 순환 참조가 있습니다.');
  }
}

function hasDirectedCycle(nodes: readonly string[], edges: ReadonlyArray<readonly [string, string]>): boolean {
  const outgoing = new Map(nodes.map(node => [node, [] as string[]]));
  const inDegree = new Map(nodes.map(node => [node, 0]));
  edges.forEach(([source, destination]) => {
    outgoing.get(source)?.push(destination);
    inDegree.set(destination, (inDegree.get(destination) ?? 0) + 1);
  });
  const remaining = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([node]) => node);
  let visitedCount = 0;
  while (remaining.length > 0) {
    const node = remaining.pop();
    if (!node) {
      continue;
    }
    visitedCount += 1;
    outgoing.get(node)?.forEach(destination => {
      const degree = (inDegree.get(destination) ?? 0) - 1;
      inDegree.set(destination, degree);
      if (degree === 0) {
        remaining.push(destination);
      }
    });
  }
  return visitedCount !== nodes.length;
}
