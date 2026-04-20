# Drop-AI 재구축 6편: TrackController — 도메인 규칙이 코드에 있어야 하는 이유

split, resize, move.  
리전을 다루는 연산은 단순해 보이지만 내부에 도메인 규칙이 있다.  
그 규칙을 어디에 두느냐가 이번 편의 핵심이다.

## 문제: 무엇이 문제였는가

리전 분할을 UI 핸들러에 넣으면 이런 코드가 된다.

```typescript
const handleSplit = (regionId: string, splitTime: number) => {
  const region = tracks.find(...).regions.find(r => r.id === regionId);
  if (!region) return;
  if (splitTime <= region.startTime || splitTime >= region.startTime + region.duration) {
    alert('분할 위치가 올바르지 않습니다');
    return;
  }
  // ... 실제 분할 로직
};
```

세 가지 문제가 있다.

1. **동일한 유효성 검증이 CLI와 Web에 복붙된다.** 규칙이 바뀌면 두 곳을 고쳐야 한다.
2. **도메인 규칙이 UI 레이어에 있다.** "분할 시간은 리전 내부여야 한다"는 비즈니스 규칙이다.
3. **테스트가 UI에 묶인다.** 분할 로직 하나를 테스트하려면 컴포넌트를 렌더링해야 한다.

증상은 규칙이 여러 곳에 흩어진다는 것이었다.  
원인은 도메인 규칙이 있어야 할 자리가 정해지지 않았다는 것이었다.

## 선택: 도메인 규칙의 위치

| 위치 | 개념 | 문제 | 판단 |
| --- | --- | --- | --- |
| UI 핸들러 | 각 화면에서 직접 검증 | 중복, UI에 도메인 로직 침투 | 제외 |
| SessionStore 액션 | 저장 전 검증 | 저장소가 도메인 규칙 판단 — 단일 책임 위반 | 제외 |
| AudioEngine | 엔진이 규칙 검증 | 오디오 처리와 비즈니스 규칙이 혼합 | 제외 |
| TrackController | UI와 저장소 사이의 도메인 레이어 | 없음 | 채택 |

판단 기준은 명확했다.  
**"이 규칙이 바뀌면 어디를 고쳐야 하는가?"**  
단 한 곳을 고치면 Web, CLI, 테스트 모두에 반영되어야 한다.  
TrackController가 그 한 곳이다.

## 해결: 어떻게 구현했는가

### 1) 트랙 추가/삭제는 엔진과 세션을 함께 처리한다

```typescript
async addTrack() {
  const id = crypto.randomUUID();

  this.audioEngine.createTrack(id);        // 1. 오디오 채널 생성
  this.sessionStore.getState().addTrack({  // 2. 세션 등록
    id,
    name: `Track ${id.slice(0, 4)}`,
    volume: 1.0,
    isMuted: false,
    isSoloed: false,
    pan: 0,
    regions: [],
  });

  return { id };
}

removeTrack(id: string): void {
  this.audioEngine.removeTrack(id); // 연결된 리전도 엔진에서 정리
  this.sessionStore.getState().removeTrack(id);
}
```

`removeTrack`에서 AudioEngine이 해당 트랙의 모든 리전도 정리한다.  
세션에서 먼저 지우면 엔진 정리 시 필요한 정보가 사라지므로 엔진을 먼저 처리한다.

### 2) 리전 추가는 파일 로딩 → 엔진 등록 → 세션 반영 순서

```typescript
async addRegion(trackId: string, file: File, startTime: number) {
  const regionId = crypto.randomUUID();

  // 1. 파일을 로드하고 duration 파악
  const { src, duration } = await this.audioEngine.loadFile(file);

  const region = { id: regionId, trackId, src, startTime, duration, offset: 0 };

  // 2. 오디오 엔진에 플레이어 등록
  this.audioEngine.addRegion(trackId, region);

  // 3. 세션에 반영
  this.sessionStore.getState().addRegion(trackId, region);

  return { regionId };
}
```

`loadFile`이 `src`(Blob URL)와 `duration`을 반환한다.  
duration은 실제 오디오 파일을 디코딩해야 알 수 있어서 파일 로딩이 먼저다.

### 3) splitRegion은 도메인 규칙을 Controller에서 검증한다

```typescript
splitRegion(trackId: string, regionId: string, splitTime: number) {
  const track = this.sessionStore.getState().tracks.get(trackId);
  if (!track) throw new Error(`Track ${trackId} not found`);

  const region = track.regions.find(r => r.id === regionId);
  if (!region) throw new Error(`Region ${regionId} not found`);

  // 도메인 규칙: 분할 시간은 리전 범위 내부여야 한다
  const regionEnd = region.startTime + region.duration;
  if (splitTime <= region.startTime || splitTime >= regionEnd) {
    throw new Error('Split time must be within region duration');
  }

  const splitOffset = region.offset + (splitTime - region.startTime);
  const leftDuration = splitTime - region.startTime;
  const rightDuration = region.duration - leftDuration;

  // 왼쪽 리전: 기존 리전을 resize
  this.resizeRegion(trackId, regionId, leftDuration);

  // 오른쪽 리전: 새 리전 생성
  const rightRegion = {
    ...region,
    id: crypto.randomUUID(),
    startTime: splitTime,
    offset: splitOffset,
    duration: rightDuration,
  };

  this.audioEngine.addRegion(trackId, rightRegion);
  this.sessionStore.getState().addRegion(trackId, rightRegion);

  return { leftId: regionId, rightId: rightRegion.id };
}
```

`throw`로 에러를 던지는 이유는 호출 측(UI/CLI)이 에러 메시지를 사용자에게 전달할 수 있게 하기 위해서다.

### 4) resizeRegion은 remove/add 패턴으로 처리한다

Tone.js의 `Player`는 동기화된 이후 duration을 직접 수정할 수 없다.  
그래서 기존 플레이어를 삭제하고 새로 생성하는 패턴을 사용한다.

```typescript
resizeRegion(trackId: string, regionId: string, newDuration: number) {
  const region = this.getRegion(trackId, regionId); // 유효성 검증 포함

  if (newDuration <= 0) throw new Error('Duration must be positive');

  // 세션 먼저 업데이트
  this.sessionStore.getState().updateRegion(trackId, regionId, { duration: newDuration });

  // 엔진은 remove/add로 재등록
  const newRegion = { ...region, duration: newDuration };
  this.audioEngine.removeRegion(trackId, regionId);
  this.audioEngine.addRegion(trackId, newRegion);
}
```

## 결과: 도메인 규칙이 한 곳에 모인다

에러 케이스를 포함한 테스트:

```typescript
describe('TrackController', () => {
  it('splitRegion은 리전 범위 밖에서 분할 시 에러를 던진다', async () => {
    const { controller, session } = setupWithTrackAndRegion();

    expect(() =>
      controller.track.splitRegion('track-1', 'region-1', 99) // 리전 범위 밖
    ).toThrow('Split time must be within region duration');
  });

  it('splitRegion은 두 개의 리전을 만든다', () => {
    const { controller, session } = setupWithTrackAndRegion({
      startTime: 0,
      duration: 10,
    });

    const { leftId, rightId } = controller.track.splitRegion('track-1', 'region-1', 4);

    const track = session.getState().tracks.get('track-1')!;
    expect(track.regions.length).toBe(2);
    expect(track.regions.find(r => r.id === leftId)?.duration).toBe(4);
    expect(track.regions.find(r => r.id === rightId)?.startTime).toBe(4);
  });
});
```

도메인 규칙("분할 시간은 리전 내부여야 한다")이 Controller 테스트에서 검증된다.  
UI나 CLI를 수정하지 않아도 이 규칙이 보장된다.

## 마무리

도메인 규칙은 UI도, 저장소도 아닌 Controller에 있어야 한다.  
규칙이 바뀔 때 한 파일만 수정하면 Web, CLI, 테스트 모두에 동시 반영된다.  
이것이 TrackController를 별도 계층으로 만든 이유다.

다음 편에서는 Controller와 Session을 조립해서 React에 주입하는 Composition Root를 다룬다.

## FAQ

### Q1. Controller에서 throw하면 UI가 크래시되지 않나?

ErrorBoundary가 잡는다. 또는 CLI에서는 `try/catch`로 에러 메시지를 터미널에 출력한다.  
Controller는 규칙 위반을 에러로 표현하고, 각 UI가 자기 방식으로 처리한다.

### Q2. resizeRegion이 remove/add 패턴인데 성능 문제가 없나?

현재 MVP에서는 사용자 인터랙션이 실시간 오디오 처리보다 훨씬 드물기 때문에 문제가 없다.  
나중에 실시간 편집이 필요하면 Tone.js의 `ToneBufferSource`를 직접 다루는 방식으로 개선할 수 있다.

### Q3. moveRegion은 왜 세션에서 region을 먼저 읽는가?

현재 startTime이 세션에 있기 때문이다.  
엔진은 실행 상태만 관리하고, "어떤 값으로 이동할지"는 세션이 진실 출처다.
