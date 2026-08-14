import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { AudioMonitorState } from '../shared/types/audio-monitor-state';
import type { SessionStore } from '../session/session';
import { ProjectStateError, ProjectStateErrorCode } from './project-state-error';
import {
  assertValidRoutingGraphSnapshot,
  cloneRoutingGraphSnapshot,
  type RoutingChannelCount,
  type RoutingGraphSnapshot,
  type RoutingRouteTarget,
  type RoutingSendState,
  type RoutingTrackKind,
} from '../shared/types/routing-state';

interface MixerControllerDependencies {
  readonly audioEngine: IAudioEngine;
  readonly sessionStore: SessionStore;
}

interface SetTrackRoutingRequest {
  readonly trackId: string;
  readonly kind: RoutingTrackKind;
  readonly channelCount: RoutingChannelCount;
  readonly output: RoutingRouteTarget;
}

interface UpdateSendRequest {
  readonly id: string;
  readonly gain: number;
  readonly tapPoint: RoutingSendState['tapPoint'];
  readonly isEnabled: boolean;
}

interface SetTrackGroupsRequest {
  readonly trackId: string;
  readonly folderId: string | null;
  readonly vcaIds: readonly string[];
}

export class MixerController {
  private readonly audioEngine: IAudioEngine;
  private readonly sessionStore: SessionStore;

  constructor({ audioEngine, sessionStore }: MixerControllerDependencies) {
    this.audioEngine = audioEngine;
    this.sessionStore = sessionStore;
  }

  setMasterVolume(volume: number): void {
    this.audioEngine.setMasterVolume(volume);
    this.sessionStore.getState().setMasterVolume(volume);
  }

  setMonitorState(state: AudioMonitorState): void {
    this.audioEngine.setMonitorState({
      isCut: state.isCut,
      isDimmed: state.isDimmed,
      isMono: state.isMono,
    });
  }

  setRoutingGraph(graph: RoutingGraphSnapshot): void {
    const session = this.sessionStore.getState();
    assertValidRoutingGraphSnapshot(graph, [...session.tracks.keys()]);
    const sendsById = new Map(graph.sends.map(send => [send.id, send]));
    session.tracks.forEach(track => {
      const invalidLane = track.automationLanes?.find(lane => {
        if (lane.target.kind !== 'sendGain') {
          return false;
        }
        const send = sendsById.get(lane.target.sendId);
        const hasInvalidOwner = send?.sourceTrackId !== track.id;
        const disablesActiveTarget = lane.isEnabled && lane.points.length > 0 && send?.isEnabled !== true;
        return hasInvalidOwner || disablesActiveTarget;
      });
      if (invalidLane?.target.kind === 'sendGain') {
        throw new ProjectStateError(
          ProjectStateErrorCode.AUTOMATION_TARGET_IN_USE,
          `Send를 대상으로 하는 Automation lane이 남아 있습니다: ${invalidLane.target.sendId}`,
          { automationLaneId: invalidLane.id, sendId: invalidLane.target.sendId, trackId: track.id }
        );
      }
    });
    this.audioEngine.setRoutingGraph(graph);
    session.setRoutingGraph(graph);
  }

  setTrackRouting(request: SetTrackRoutingRequest): void {
    const graph = this.getRoutingGraph();
    const routeIndex = graph.routes.findIndex(route => route.trackId === request.trackId);
    if (routeIndex < 0) {
      throw new Error(`Track Route를 찾을 수 없습니다: ${request.trackId}`);
    }
    graph.routes[routeIndex] = {
      ...graph.routes[routeIndex],
      channelCount: request.channelCount,
      kind: request.kind,
      output: { ...request.output },
      trackId: request.trackId,
    };
    this.setRoutingGraph(graph);
  }

  addSend(send: RoutingSendState): void {
    const graph = this.getRoutingGraph();
    if (graph.sends.some(candidate => candidate.id === send.id)) {
      throw new Error(`Send ID가 중복됐습니다: ${send.id}`);
    }
    graph.sends.push({
      destinationTrackId: send.destinationTrackId,
      gain: send.gain,
      id: send.id,
      isEnabled: send.isEnabled,
      sourceTrackId: send.sourceTrackId,
      tapPoint: send.tapPoint,
    });
    this.setRoutingGraph(graph);
  }

  updateSend(request: UpdateSendRequest): void {
    const graph = this.getRoutingGraph();
    const sendIndex = graph.sends.findIndex(send => send.id === request.id);
    if (sendIndex < 0) {
      throw new Error(`Send를 찾을 수 없습니다: ${request.id}`);
    }
    graph.sends[sendIndex] = {
      ...graph.sends[sendIndex],
      gain: request.gain,
      id: request.id,
      isEnabled: request.isEnabled,
      tapPoint: request.tapPoint,
    };
    this.setRoutingGraph(graph);
  }

  removeSend(sendId: string): void {
    const graph = this.getRoutingGraph();
    if (!graph.sends.some(send => send.id === sendId)) {
      throw new Error(`Send를 찾을 수 없습니다: ${sendId}`);
    }
    graph.sends = graph.sends.filter(send => send.id !== sendId);
    this.setRoutingGraph(graph);
  }

  setTrackGroups(request: SetTrackGroupsRequest): void {
    const graph = this.getRoutingGraph();
    const routeIndex = graph.routes.findIndex(route => route.trackId === request.trackId);
    if (routeIndex < 0) {
      throw new Error(`Track Route를 찾을 수 없습니다: ${request.trackId}`);
    }
    graph.routes[routeIndex] = {
      ...graph.routes[routeIndex],
      folderId: request.folderId,
      vcaIds: [...request.vcaIds],
    };
    this.setRoutingGraph(graph);
  }

  private getRoutingGraph(): { routes: Array<RoutingGraphSnapshot['routes'][number]>; sends: RoutingSendState[] } {
    const graph = cloneRoutingGraphSnapshot(this.sessionStore.getState().routingGraph);
    return { routes: [...graph.routes], sends: [...graph.sends] };
  }
}
