# Drop-AI 재구축 5편: PlaybackController — 재생 도메인의 단일 책임

재생 버튼을 눌렀을 때 일어나는 일은 두 가지다.  
오디오 엔진이 소리를 내고, 세션이 "재생 중" 상태가 된다.  
이 두 가지 순서와 책임을 어디에 둘지가 이번 편의 주제다.

## 문제: 무엇이 문제였는가

재생 기능을 UI 핸들러에 직접 구현하면 이런 코드가 나온다.

```typescript
// 버튼 onClick 핸들러
const handlePlay = async () => {
  await Tone.getTransport().start(); // 오디오 엔진 직접 호출
  setIsPlaying(true);                // React 상태 변경
};
```

지금은 버튼 하나지만, 이 패턴이 반복되면:
- CLI의 `play` 명령도 같은 코드를 복붙한다.
- 루프 종료 후 자동 정지도 같은 코드를 또 쓴다.
- BPM 변경 시 엔진 동기화도 흩어진다.

증상은 재생 관련 코드가 여러 곳에 있다는 것이었다.  
원인은 재생 도메인의 책임이 UI에 있었다는 것이었다.

## 선택: 어디에 재생 로직을 두는가

| 위치 | 개념 | 단점 | 판단 |
| --- | --- | --- | --- |
| UI 핸들러 | 버튼마다 직접 구현 | CLI/Web 중복, 테스트 불가 | 제외 |
| Zustand 액션 | 상태 변경 함수 안에 오디오 호출 포함 | 부수효과와 상태 로직 혼합 | 제외 |
| AudioEngine 내부 | 엔진이 세션 상태까지 관리 | 오디오 계층이 UI 계층에 역방향 의존 | 제외 |
| PlaybackController | 엔진 호출 + 세션 갱신을 한 곳에서 조율 | 없음 | 채택 |

재생 도메인의 책임은 세 가지다.
1. AudioEngine에 오디오 명령을 전달한다.
2. Session에 결과 상태를 반영한다.
3. 두 작업의 순서를 보장한다.

이 셋을 한 클래스에 모은 것이 `PlaybackController`다.

## 해결: 어떻게 구현했는가

### 1) 엔진 호출 → 세션 갱신 순서를 모든 메서드에 일관되게 적용한다

`play`를 예시로 보면:

```typescript
async handlePlay(): Promise<void> {
  await this.audioEngine.play();            // 1. 오디오 엔진 먼저
  this.sessionStore.getState().setPlaying(true); // 2. 세션 반영
}
```

순서가 중요한 이유는 오디오 엔진이 실패하면 세션 상태를 바꾸면 안 되기 때문이다.  
엔진 호출이 먼저이고, 성공 후에 세션을 갱신한다.  
`stop`과 `pause`도 같은 패턴을 따른다.

```typescript
handleStop(): void {
  this.audioEngine.stop();
  this.sessionStore.getState().setPlaying(false);
}

handlePause(): void {
  this.audioEngine.pause();
  this.sessionStore.getState().setPlaying(false);
}
```

### 2) 루프는 켜고 끄는 두 경로를 분기한다

루프는 단순한 토글이 아니다.  
켤 때는 구간도 함께 설정하고, 끌 때는 구간을 초기화한다.

```typescript
handleLoop(start: number, end: number, isLooping: boolean): void {
  if (isLooping) {
    this.audioEngine.setLoopPoints(start, end);
    this.audioEngine.setLoop(true);
    this.sessionStore.getState().setLoopPoints(start, end);
    this.sessionStore.getState().setLoop(true);
  } else {
    this.audioEngine.setLoop(false);
    this.sessionStore.getState().setLoop(false);
  }
}
```

루프를 끌 때 구간 값은 세션에 남겨둔다.  
다시 켤 때 이전 구간이 복원되도록 하기 위해서다.

### 3) BPM과 마스터 볼륨은 단순 위임 + 세션 반영

```typescript
handleBpm(bpm: number): void {
  this.audioEngine.setBpm(bpm);
  this.sessionStore.getState().setBpm(bpm);
}

handleMasterVolume(volume: number): void {
  this.audioEngine.setVolume(volume);
  this.sessionStore.getState().setMasterVolume(volume);
}
```

볼륨 범위 검증(0~1)은 이 시점에서 하지 않는다.  
UI에서 입력을 제한하거나 CLI에서 입력 검증을 한다.  
Controller는 유효한 입력이 들어온다고 가정한다.

### 4) seek와 getCurrentTime은 엔진 직접 위임

```typescript
handleSeek(time: number): void {
  this.audioEngine.seekTo(time);
}

getCurrentTime(): number {
  return this.audioEngine.getCurrentTime();
}
```

`seek`는 세션에 반영하지 않는다.  
현재 재생 위치는 UI가 주기적으로 `getCurrentTime()`을 폴링해서 표시한다.  
초당 60회 변하는 값을 세션에 쓰면 불필요한 리렌더가 발생한다.

## 결과: 테스트로 동작을 검증한다

Mock 엔진으로 Controller 행동을 단위 테스트한다.

```typescript
describe('PlaybackController', () => {
  let engine: MockAudioEngine;
  let session: SessionStore;
  let controller: PlaybackController;

  beforeEach(() => {
    engine = new MockAudioEngine();
    session = createSessionStore();
    controller = new PlaybackController(session, engine);
  });

  it('handlePlay는 엔진을 실행하고 세션을 갱신한다', async () => {
    await controller.handlePlay();

    expect(engine.calls[0].method).toBe('play');
    expect(session.getState().isPlaying).toBe(true);
  });

  it('handleStop은 엔진을 정지하고 세션을 갱신한다', () => {
    controller.handleStop();

    expect(engine.calls[0].method).toBe('stop');
    expect(session.getState().isPlaying).toBe(false);
  });

  it('handleLoop(on)은 구간을 설정하고 세션에 반영한다', () => {
    controller.handleLoop(2, 8, true);

    const state = session.getState();
    expect(state.isLooping).toBe(true);
    expect(state.loopStart).toBe(2);
    expect(state.loopEnd).toBe(8);
  });

  it('handleLoop(off)는 루프를 끄고 구간은 세션에 유지한다', () => {
    controller.handleLoop(2, 8, true);
    controller.handleLoop(0, 0, false);

    const state = session.getState();
    expect(state.isLooping).toBe(false);
    expect(state.loopStart).toBe(2); // 구간 유지
  });
});
```

오디오 없이 Node.js에서 이 테스트가 통과한다.

## 마무리

PlaybackController는 재생 도메인의 모든 명령이 거치는 단일 지점이다.  
엔진 호출 → 세션 반영이라는 순서를 모든 메서드에서 일관되게 유지한다.  
이 일관성 덕분에 "play를 호출하면 어떤 일이 일어나는가"를 한 파일에서 파악할 수 있다.

다음 편에서는 트랙/리전 편집을 담당하는 TrackController를 구현한다.

## FAQ

### Q1. seek를 세션에 반영하지 않으면 UI가 현재 위치를 어떻게 표시하나?

UI에서 `setInterval`로 주기적으로 `controller.playback.getCurrentTime()`을 호출해서 로컬 상태로 관리한다.  
초당 수십 번 변하는 값은 세션보다 UI 로컬 상태로 관리하는 것이 렌더링 성능에 유리하다.

### Q2. 엔진 호출이 실패하면 세션은 어떻게 되나?

현재 구현에서는 엔진 호출 이후에 세션을 갱신하므로 엔진 실패 시 세션은 변경되지 않는다.  
에러가 위로 전파되고 UI에서 ErrorBoundary가 처리한다.

### Q3. BPM 유효성 검증은 어디서 하나?

CLI에서는 입력 파싱 시, Web UI에서는 입력 컴포넌트 수준에서 제한한다.  
Controller는 유효한 값이 들어온다고 가정하고, 잘못된 값에 대한 방어는 진입 지점에서 처리한다.
