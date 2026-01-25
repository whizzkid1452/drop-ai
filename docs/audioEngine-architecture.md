## AudioEngine 쉽게 이해하기

### 핵심 개념

AudioEngine은 오디오 재생을 관리하는 중앙 제어실입니다. 싱글톤으로 하나의 인스턴스만 존재하며, 모든 오디오 명령을 `execute()`로 처리합니다.

### 전체 구조도

flowchart TD
%% 스타일 정의
classDef engineBox fill:#f9f9f9,stroke:#333,stroke-width:2px;
classDef innerBox fill:#fff,stroke:#666,stroke-dasharray: 5 5;
classDef external fill:#e1f5fe,stroke:#0277bd;
classDef library fill:#fff3e0,stroke:#ef6c00;

    %% 메인 AudioEngine 서브그래프
    subgraph AudioEngine ["AudioEngine (싱글톤)"]
        direction TB

        %% 1. 상태 (State)
        Tracks["<b>tracks: Map &lt;trackId, Object&gt;</b><br/>---------------------------------------------<br/>channel: Tone.Channel ← 볼륨/팬 제어<br/>players: Map&lt;regionId, Tone.Player&gt; ← 오디오 파일"]:::innerBox

        %% 2. 실행부 (Gateway)
        Execute["<b>execute(command, callback?) ← 모든 명령의 입구</b><br/>---------------------------------------------<br/>PLAY → Transport.start()<br/>PAUSE → Transport.pause()<br/>STOP → Transport.stop()<br/>SET_TRACK_VOLUME → channel.volume 조절<br/>SET_TRACK_PAN → channel.pan 조절<br/>LOAD_REGION → Player 생성 및 로드<br/>GET_TRACK_INFO → 트랙 정보 반환<br/>SET_CURRENT_TIME → 재생 위치 설정"]:::innerBox

        %% 3. 내부 메서드 (Implementation)
        Methods["<b>내부 메서드들</b><br/>---------------------------------------------<br/>initTrack() → 트랙 초기화<br/>loadRegion() → 오디오 파일 로드<br/>setTrackVolume() → 볼륨 설정<br/>setTrackPan() → 팬 설정<br/>getTrackInfo() → 트랙 정보 가져오기<br/>getTrackParams() → 현재 파라미터 조회<br/>getSeconds() → 현재 재생 시간"]:::innerBox

        %% 내부 구조 연결
        Tracks --- Execute
        Execute --- Methods
    end

    %% 외부 요소 (Callers & Dependencies)
    subgraph Clients ["명령 전달"]
        AI[AI Agent]:::external
        UI[UI 컴포넌트]:::external
    end

    subgraph Libs ["상태 동기화 및 라이브러리"]
        Tone[Tone.js<br/>라이브러리]:::library
        Zustand[Zustand<br/>Store]:::library
    end

    %% 외부와 엔진의 연결
    AI --> AudioEngine
    UI --> AudioEngine

    AudioEngine -.- Tone
    AudioEngine -.- Zustand

    %% 싱글톤 접근 주석 (두 번째 이미지 내용 반영)
    note[getInstance<br/>싱글톤 접근] -.-> AudioEngine

    class AudioEngine engineBox

### 데이터 구조

```
AudioEngine
│
├─ tracks (Map)
   │
   └─ trackId (예: "track-1")
      │
      ├─ channel (Tone.Channel)
      │  ├─ volume: 0 dB (기본값)
      │  └─ pan: 0 (중앙)
      │
      └─ players (Map)
         │
         └─ regionId (예: "region-1")
            └─ player (Tone.Player)
               ├─ url: "audio.mp3"
               ├─ loop: false
               └─ startTime: 0초

```

### 동작 흐름

### 1. 초기화

```tsx
const engine = AudioEngine.getInstance(); // 싱글톤 인스턴스 가져오기
```

### 2. 오디오 파일 로드

```tsx
await engine.execute({
  command: {
    type: 'LOAD_REGION',
    trackId: 'track-1',
    regionId: 'region-1',
    url: '<https://example.com/audio.mp3>',
    startTime: 0,
  },
});
```

- 트랙이 없으면 자동 생성
- Player 생성 후 Channel에 연결
- 로드 완료 시 자동 재생 시작

### 3. 재생 제어

```tsx
// 재생
await engine.execute({ command: { type: 'PLAY' } });

// 일시정지
engine.execute({ command: { type: 'PAUSE' } });

// 정지
engine.execute({ command: { type: 'STOP' } });
```

### 4. 볼륨/팬 조절

```tsx
// 볼륨 설정 (0.0 ~ 1.0)
engine.execute({
  command: {
    type: 'SET_TRACK_VOLUME',
    trackId: 'track-1',
    volume: 0.8, // 80% 볼륨
  },
});

// 팬 설정 (-1.0 ~ 1.0)
engine.execute({
  command: {
    type: 'SET_TRACK_PAN',
    trackId: 'track-1',
    pan: -0.5, // 왼쪽으로 50%
  },
});
```

### 주요 특징

1. 싱글톤 패턴: 하나의 인스턴스만 존재
2. Gateway 패턴: 모든 명령은 `execute()`로 처리
3. 자동 초기화: 트랙이 없으면 자동 생성
4. 콜백 지원: 명령 실행 후 콜백으로 UI 업데이트 가능

### 실제 사용 예시

```tsx
// AI 에이전트가 명령을 생성하면
const engine = AudioEngine.getInstance();

await engine.execute({
  command: {
    type: 'SET_TRACK_VOLUME',
    trackId: 'track-1',
    volume: 0.7,
  },
  callback: ({ command, result }) => {
    // UI 상태 업데이트
    updateUI();
  },
});
```

### 핵심 포인트

- Track = Channel: 각 트랙은 하나의 Channel로 관리
- Region = Player: 각 리전은 하나의 Player로 재생
- Transport: 전체 재생/일시정지/정지를 Transport로 제어
- 자동 연결: Player는 자동으로 Channel에 연결되어 출력

이 구조로 오디오를 체계적으로 관리합니다. 추가 질문이 있으면 알려주세요.
