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
  readonly configuredGain: number;
  readonly gain: Tone.Gain;
  readonly sendId: string;
}

interface AudioSendDescriptor extends AudioRouteConnection {
  readonly configuredGain: number;
  readonly sendId: string;
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
    const nextSendDescriptors = graph.sends
      .filter(send => send.isEnabled)
      .map(send => {
        const source = this.getSignalTrackNodes(trackNodes, send.sourceTrackId);
        const destination = this.getSignalTrackNodes(trackNodes, send.destinationTrackId).input;
        return {
          configuredGain: send.gain,
          destination,
          sendId: send.id,
          source: send.tapPoint === 'preFader' ? source.preFaderOutput : source.postFaderOutput,
        };
      });
    const previousRoutes = [...this.routeConnections];
    const routesToConnect: AudioRouteConnection[] = [];
    const nextRouteConnections = nextRoutes.map(connection => {
      const reusableIndex = previousRoutes.findIndex(previous => this.isSameRoute(previous, connection));
      if (reusableIndex >= 0) {
        return previousRoutes.splice(reusableIndex, 1)[0];
      }
      routesToConnect.push(connection);
      return connection;
    });
    const previousSends = [...this.sendConnections];
    const sendsToConnect: AudioSendConnection[] = [];
    const nextSendConnections = nextSendDescriptors.map(descriptor => {
      const reusableIndex = previousSends.findIndex(previous => this.isSameSend(previous, descriptor));
      if (reusableIndex >= 0) {
        return previousSends.splice(reusableIndex, 1)[0];
      }
      const connection = { ...descriptor, gain: new Tone.Gain({ gain: descriptor.configuredGain }) };
      sendsToConnect.push(connection);
      return connection;
    });

    try {
      routesToConnect.forEach(connection => connection.source.connect(connection.destination));
      sendsToConnect.forEach(connection => {
        connection.gain.connect(connection.destination);
        connection.source.connect(connection.gain);
      });
    } catch (cause) {
      routesToConnect.forEach(connection => this.disconnect(connection));
      sendsToConnect.forEach(connection => this.disposeSend(connection));
      throw cause;
    }

    previousRoutes.forEach(connection => this.disconnect(connection));
    previousSends.forEach(connection => this.disposeSend(connection));
    this.routeConnections = nextRouteConnections;
    this.sendConnections = nextSendConnections;
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

  private isSameRoute(left: AudioRouteConnection, right: AudioRouteConnection): boolean {
    return left.source === right.source && left.destination === right.destination;
  }

  private isSameSend(left: AudioSendConnection, right: AudioSendDescriptor): boolean {
    return (
      left.sendId === right.sendId && left.configuredGain === right.configuredGain && this.isSameRoute(left, right)
    );
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
