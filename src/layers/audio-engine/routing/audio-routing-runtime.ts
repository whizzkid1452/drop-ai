import * as Tone from 'tone';
import { assertValidRoutingGraphSnapshot, cloneRoutingGraphSnapshot } from '../../shared/types/routing-state';
import type { RoutingGraphSnapshot, RoutingRouteState } from '../../shared/types/routing-state';

export interface AudioRoutingTrackNodes {
  readonly input: Tone.Gain;
  readonly preFaderOutput: Tone.Gain;
  readonly postFaderOutput: Tone.Gain;
}

interface AudioRouteConnection {
  readonly source: Tone.Gain;
  readonly destination: Tone.Gain;
}

interface AudioSendConnection extends AudioRouteConnection {
  readonly gain: Tone.Gain;
}

export class AudioRoutingRuntime {
  private graph: RoutingGraphSnapshot = { routes: [], sends: [] };
  private routeConnections: AudioRouteConnection[] = [];
  private sendConnections: AudioSendConnection[] = [];

  getSnapshot(): RoutingGraphSnapshot {
    return cloneRoutingGraphSnapshot(this.graph);
  }

  apply(
    graph: RoutingGraphSnapshot,
    trackNodes: ReadonlyMap<string, AudioRoutingTrackNodes>,
    masterOutput: Tone.Gain
  ): void {
    assertValidRoutingGraphSnapshot(
      graph,
      graph.routes.map(route => route.trackId)
    );
    const nextRoutes = graph.routes.flatMap(route => this.createRouteConnection(route, trackNodes, masterOutput));
    const nextSends = graph.sends
      .filter(send => send.isEnabled)
      .map(send => {
        const source = this.getSignalTrackNodes(trackNodes, send.sourceTrackId);
        const destination = this.getSignalTrackNodes(trackNodes, send.destinationTrackId).input;
        const gain = new Tone.Gain({ gain: send.gain });
        return {
          destination,
          gain,
          source: send.tapPoint === 'preFader' ? source.preFaderOutput : source.postFaderOutput,
        };
      });

    try {
      nextRoutes.forEach(connection => connection.source.connect(connection.destination));
      nextSends.forEach(connection => {
        connection.gain.connect(connection.destination);
        connection.source.connect(connection.gain);
      });
    } catch (cause) {
      nextRoutes.forEach(connection => this.disconnect(connection));
      nextSends.forEach(connection => this.disposeSend(connection));
      throw cause;
    }

    this.routeConnections.forEach(connection => this.disconnect(connection));
    this.sendConnections.forEach(connection => this.disposeSend(connection));
    this.routeConnections = nextRoutes;
    this.sendConnections = nextSends;
    this.graph = cloneRoutingGraphSnapshot(graph);
  }

  dispose(): void {
    this.routeConnections.forEach(connection => this.disconnect(connection));
    this.sendConnections.forEach(connection => this.disposeSend(connection));
    this.routeConnections = [];
    this.sendConnections = [];
    this.graph = { routes: [], sends: [] };
  }

  private createRouteConnection(
    route: RoutingRouteState,
    trackNodes: ReadonlyMap<string, AudioRoutingTrackNodes>,
    masterOutput: Tone.Gain
  ): AudioRouteConnection[] {
    if (route.output.kind === 'none') {
      return [];
    }
    const source = this.getSignalTrackNodes(trackNodes, route.trackId).postFaderOutput;
    const destination =
      route.output.kind === 'master' ? masterOutput : this.getSignalTrackNodes(trackNodes, route.output.trackId).input;
    return [{ destination, source }];
  }

  private getSignalTrackNodes(
    trackNodes: ReadonlyMap<string, AudioRoutingTrackNodes>,
    trackId: string
  ): AudioRoutingTrackNodes {
    const nodes = trackNodes.get(trackId);
    if (!nodes) {
      throw new Error(`신호 Route의 Track node가 없습니다: ${trackId}`);
    }
    return nodes;
  }

  private disconnect(connection: AudioRouteConnection): void {
    connection.source.disconnect(connection.destination);
  }

  private disposeSend(connection: AudioSendConnection): void {
    connection.source.disconnect(connection.gain);
    connection.gain.disconnect(connection.destination);
    connection.gain.dispose();
  }
}
