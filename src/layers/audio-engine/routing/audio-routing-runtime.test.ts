import { describe, expect, it, vi } from 'vitest';
import { AudioRoutingRuntime, type AudioRoutingTrackNodes } from './audio-routing-runtime';

interface FakeNode {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

const gainInstances: Array<FakeNode & { dispose: ReturnType<typeof vi.fn> }> = [];

vi.mock('tone', () => ({
  Gain: class {
    connect = vi.fn();
    disconnect = vi.fn();
    dispose = vi.fn();

    constructor() {
      gainInstances.push(this);
    }
  },
}));

const AUDIO_ID = '11111111-1111-4111-8111-111111111111';
const BUS_ID = '22222222-2222-4222-8222-222222222222';

function createNode(): FakeNode {
  return { connect: vi.fn(), disconnect: vi.fn() };
}

function createTrackNodes(): AudioRoutingTrackNodes {
  return {
    input: createNode() as never,
    postFaderOutput: createNode() as never,
    preFaderOutput: createNode() as never,
  };
}

describe('AudioRoutingRuntime', () => {
  it('Track 출력과 pre-fader Send를 Bus 입력에 연결한다', () => {
    const runtime = new AudioRoutingRuntime();
    const audioNodes = createTrackNodes();
    const busNodes = createTrackNodes();
    const master = createNode();

    runtime.apply(
      {
        routes: [
          {
            channelCount: 2,
            folderId: null,
            kind: 'audio',
            output: { kind: 'track', trackId: BUS_ID },
            trackId: AUDIO_ID,
            vcaIds: [],
          },
          {
            channelCount: 2,
            folderId: null,
            kind: 'bus',
            output: { kind: 'master' },
            trackId: BUS_ID,
            vcaIds: [],
          },
        ],
        sends: [
          {
            destinationTrackId: BUS_ID,
            gain: 0.5,
            id: '33333333-3333-4333-8333-333333333333',
            isEnabled: true,
            sourceTrackId: AUDIO_ID,
            tapPoint: 'preFader',
          },
        ],
      },
      new Map([
        [AUDIO_ID, audioNodes],
        [BUS_ID, busNodes],
      ]),
      master as never
    );

    expect(audioNodes.postFaderOutput.connect).toHaveBeenCalledWith(busNodes.input);
    expect(busNodes.postFaderOutput.connect).toHaveBeenCalledWith(master);
    expect(audioNodes.preFaderOutput.connect).toHaveBeenCalledWith(gainInstances[0]);
    expect(gainInstances[0]?.connect).toHaveBeenCalledWith(busNodes.input);
  });

  it('graph 재적용 시 동일 Route 연결은 재사용하고 바뀐 Route만 교체한다', () => {
    const runtime = new AudioRoutingRuntime();
    const audioNodes = createTrackNodes();
    const busNodes = createTrackNodes();
    const master = createNode();
    const trackNodes = new Map([
      [AUDIO_ID, audioNodes],
      [BUS_ID, busNodes],
    ]);
    const masterGraph = {
      routes: [
        {
          channelCount: 2 as const,
          folderId: null,
          kind: 'audio' as const,
          output: { kind: 'master' as const },
          trackId: AUDIO_ID,
          vcaIds: [],
        },
        {
          channelCount: 2 as const,
          folderId: null,
          kind: 'bus' as const,
          output: { kind: 'master' as const },
          trackId: BUS_ID,
          vcaIds: [],
        },
      ],
      sends: [],
    };
    runtime.apply(masterGraph, trackNodes as never, master as never);
    vi.mocked(audioNodes.postFaderOutput.connect).mockClear();
    vi.mocked(audioNodes.postFaderOutput.disconnect).mockClear();
    vi.mocked(busNodes.postFaderOutput.connect).mockClear();
    vi.mocked(busNodes.postFaderOutput.disconnect).mockClear();

    runtime.apply(
      {
        ...masterGraph,
        routes: [
          { ...masterGraph.routes[0], output: { kind: 'track' as const, trackId: BUS_ID } },
          masterGraph.routes[1],
        ],
      },
      trackNodes as never,
      master as never
    );

    expect(audioNodes.postFaderOutput.connect).toHaveBeenCalledOnce();
    expect(audioNodes.postFaderOutput.connect).toHaveBeenCalledWith(busNodes.input);
    expect(audioNodes.postFaderOutput.disconnect).toHaveBeenCalledWith(master);
    expect(busNodes.postFaderOutput.connect).not.toHaveBeenCalled();
    expect(busNodes.postFaderOutput.disconnect).not.toHaveBeenCalled();
  });
});
