# Ruler 컴포넌트 아키텍처

## 개요

Ruler는 DAW의 타임라인 상단에 위치한 룰러 컴포넌트로, 마디/비트 구분선을 표시하고 클릭/드래그로 플레이헤드를 이동시킬 수 있습니다. Ardour 스타일의 디자인과 동작을 따릅니다.

## 컴포넌트 구조

### 1. **RulerWrapper** (`src/components/DAW/Ruler/RulerWrapper.tsx`)
룰러의 외부 래퍼 컴포넌트

```
┌─────────────────────────────────────┐
│  RulerWrapper                       │
│  ┌──────────┐  ┌─────────────────┐ │
│  │ Spacer   │  │ ScrollContainer │ │
│  │ (296px)  │  │   (스크롤 가능)  │ │
│  └──────────┘  └─────────────────┘ │
│                  ┌───────────────┐ │
│                  │    Ruler       │ │
│                  └───────────────┘ │
└─────────────────────────────────────┘
```

**역할:**
- 좌측 스페이서(296px) 제공 (트랙 컨트롤 영역과 정렬)
- 스크롤 컨테이너 제공 (스크롤 동기화를 위한 ref)
- Ruler 컴포넌트를 감싸서 레이아웃 구성

**Props:**
```typescript
interface RulerWrapperProps {
  bpm: number;                    // BPM (마디/비트 계산용)
  playheadRef: RefObject<HTMLDivElement>;  // 플레이헤드 ref
  timelineDuration: number;        // 타임라인 길이 (초)
  onRulerClick?: (positionSeconds: number) => void;  // 클릭 핸들러
  pixelsPerSecond: number;         // 줌 레벨 (픽셀/초)
}
```

### 2. **Ruler** (`src/components/DAW/Ruler/Ruler.tsx`)
실제 룰러 컴포넌트

**주요 기능:**
1. 마디/비트 구분선 계산 및 표시
2. 마디 번호 표시
3. 클릭/드래그로 플레이헤드 이동
4. 스크롤 오프셋 고려한 정확한 위치 계산

## 핵심 로직

### 1. 마디/비트 구분선 계산

```typescript
const markers = useMemo(() => {
  const markers: RulerMarker[] = [];
  
  const secondsPerBeat = 60 / bpm;        // 비트당 초
  const beatsPerBar = BEATS_PER_BAR;      // 마디당 비트 (4)
  const secondsPerBar = secondsPerBeat * beatsPerBar;  // 마디당 초
  
  const maxBar = Math.ceil(timelineDuration / secondsPerBar);
  
  for (let bar = 0; bar <= maxBar; bar++) {
    const barTime = bar * secondsPerBar;
    
    if (barTime <= timelineDuration) {
      // 마디 시작점 (굵은 선)
      markers.push({
        type: 'bar',
        time: barTime,
        barNumber: bar + 1,
      });
      
      // 비트 구분선 (얇은 선)
      for (let beat = 1; beat < beatsPerBar; beat++) {
        const beatTime = barTime + beat * secondsPerBeat;
        if (beatTime <= timelineDuration) {
          markers.push({
            type: 'beat',
            time: beatTime,
          });
        }
      }
    }
  }
  
  return markers.sort((a, b) => a.time - b.time);
}, [bpm, timelineDuration]);
```

**예시 (BPM 120, 타임라인 30초):**
- `secondsPerBeat = 60 / 120 = 0.5초`
- `secondsPerBar = 0.5 * 4 = 2초`
- 마디 1: 0초 (Bar 1)
  - 비트 1: 0.5초
  - 비트 2: 1.0초
  - 비트 3: 1.5초
- 마디 2: 2초 (Bar 2)
  - 비트 1: 2.5초
  - ...

### 2. 클릭 위치 계산

```typescript
const computePositionFromClientX = useCallback(
  (clientX: number) => {
    const rulerContent = rulerContentRef.current;
    if (!rulerContent) return null;
    
    // 1. 클릭한 위치의 뷰포트 상대 좌표
    const rect = rulerContent.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    
    // 2. 스크롤 오프셋 찾기 (부모 요소 중 스크롤 가능한 요소)
    const scrollLeft = getScrollLeft(rulerContent);
    
    // 3. 전체 타임라인에서의 절대 위치
    const totalX = Math.max(0, offsetX + scrollLeft);
    
    // 4. 픽셀을 초로 변환
    const positionSeconds = totalX / pixelsPerSecond;
    
    // 5. 타임라인 범위 내로 제한
    return Math.max(0, Math.min(positionSeconds, timelineDuration));
  },
  [getScrollLeft, timelineDuration, pixelsPerSecond]
);
```

**스크롤 오프셋 찾기:**
```typescript
const getScrollLeft = useCallback((target: HTMLElement) => {
  let scrollLeft = 0;
  let currentElement: HTMLElement | null = target.parentElement;
  
  // 부모 요소를 따라 올라가며 스크롤 가능한 요소 찾기
  while (currentElement) {
    if (
      currentElement.scrollWidth > currentElement.clientWidth ||
      currentElement.scrollLeft > 0
    ) {
      scrollLeft = currentElement.scrollLeft;
      break;
    }
    currentElement = currentElement.parentElement;
  }
  
  return scrollLeft;
}, []);
```

### 3. 드래그 처리

```typescript
const handleMouseDown = useCallback(
  (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onRulerClick) return;
    event.preventDefault();
    
    isDraggingRef.current = true;
    updatePositionFromClientX(event.clientX);
    
    // 전역 이벤트 리스너 등록
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  },
  [handleMouseMove, handleMouseUp, onRulerClick, updatePositionFromClientX]
);

const handleMouseMove = useCallback(
  (event: MouseEvent) => {
    if (!isDraggingRef.current) return;
    event.preventDefault();
    updatePositionFromClientX(event.clientX);
  },
  [updatePositionFromClientX]
);

const handleMouseUp = useCallback(
  (event: MouseEvent) => {
    if (!isDraggingRef.current) return;
    event.preventDefault();
    updatePositionFromClientX(event.clientX);
    isDraggingRef.current = false;
    
    // 전역 이벤트 리스너 제거
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  },
  [handleMouseMove, updatePositionFromClientX]
);
```

## 렌더링

### 마디/비트 구분선 렌더링

```typescript
{markers.map((marker, index) => {
  // 픽셀 기반으로 정확한 위치 계산 (동적 pixelsPerSecond 반영)
  const leftPx = marker.time * pixelsPerSecond;
  
  return (
    <div
      key={`${marker.type}-${marker.time}-${index}`}
      className={
        marker.type === 'bar' ? styles.barMarker : styles.beatMarker
      }
      style={{ left: `${leftPx}px` }}
    >
      {/* 마디 번호 표시 */}
      {marker.type === 'bar' && marker.barNumber && (
        <span className={styles.barNumber}>{marker.barNumber}</span>
      )}
    </div>
  );
})}
```

**스타일:**
- **마디 구분선 (barMarker)**: 굵은 선 (2px), 전체 높이, accent 색상
- **비트 구분선 (beatMarker)**: 얇은 선 (1px), 하단 8px부터, divider 색상
- **마디 번호**: 상단 좌측, 작은 폰트, 반투명 배경

## 플레이헤드 연동

Ruler는 플레이헤드를 직접 렌더링하지 않고, `playheadRef`를 받아서 TrackTimeline에서 관리하는 글로벌 플레이헤드와 연동합니다.

```typescript
{playheadRef && (
  <div
    className={styles.playhead}
    ref={playheadRef}
    style={{ left: '0%', opacity: 0, display: 'none' }}
  />
)}
```

**참고:** 실제 플레이헤드는 TrackTimeline의 `globalPlayhead`로 렌더링되며, Ruler 내부의 playhead div는 숨겨져 있습니다.

## 데이터 흐름

### 클릭/드래그 시

```
사용자 클릭/드래그
  ↓
handleMouseDown / handleMouseMove
  ↓
computePositionFromClientX
  ├─ 뷰포트 좌표 → 절대 좌표 변환
  ├─ 스크롤 오프셋 고려
  └─ 픽셀 → 초 변환
  ↓
updatePositionFromClientX
  ↓
onRulerClick(positionSeconds)
  ↓
TrackTimeline.handleRulerClick
  ├─ AudioEngine.setPosition()
  └─ Zustand Store.setPosition()
      └─ 모든 컴포넌트 자동 업데이트
```

## 스타일링

### Ruler.css.ts

```typescript
// 컨테이너
container: 높이 40px, 배경색 surfaceRaised

// 룰러 콘텐츠
rulerContent: cursor: pointer (클릭 가능 표시)

// 마디 구분선
barMarker: 
  - width: 2px
  - backgroundColor: accent (보라색)
  - 전체 높이
  - zIndex: 2

// 비트 구분선
beatMarker:
  - width: 1px
  - backgroundColor: divider (회색)
  - top: 8px (상단 여백)
  - zIndex: 1

// 마디 번호
barNumber:
  - fontSize: 0.75rem
  - fontWeight: 600
  - backgroundColor: rgba(255, 255, 255, 0.85)
  - padding: 2px 4px
  - borderRadius: 2px
```

### RulerWrapper.css.ts

```typescript
// 래퍼
wrapper:
  - display: grid
  - gridTemplateColumns: 296px 1fr (스페이서 + 스크롤 영역)

// 스페이서
spacer:
  - width: 296px (트랙 컨트롤 영역과 정렬)
  - borderRight: 1px solid border
  - zIndex: 20

// 스크롤 컨테이너
scrollContainer:
  - overflowX: auto
  - scrollbarWidth: none (스크롤바 숨김)
```

## 사용 예시

### TrackTimeline에서 사용

```typescript
<RulerWrapper
  ref={rulerScrollRef}              // 스크롤 동기화용 ref
  bpm={bpm}
  playheadRef={rulerPlayheadRef}    // 플레이헤드 ref
  timelineDuration={computedDuration}
  onRulerClick={handleRulerClick}   // 클릭 핸들러
  pixelsPerSecond={dynamicPixelsPerSecond}  // 동적 줌 레벨
/>
```

### handleRulerClick 구현

```typescript
const handleRulerClick = useCallback(
  (positionSeconds: number) => {
    engine.setPosition(positionSeconds);
    // zustand store 업데이트 (모든 컴포넌트에 즉시 반영)
    setPlayheadPosition(positionSeconds);
  },
  [engine, setPlayheadPosition]
);
```

## 특징

### 1. Ardour 스타일
- 마디/비트 구분선이 명확하게 표시됨
- 클릭/드래그로 플레이헤드 즉시 이동
- 마디 번호가 명확하게 표시됨

### 2. 동적 줌 지원
- `pixelsPerSecond`에 따라 마디/비트 구분선 위치 자동 조정
- 픽셀 기반 계산으로 정확한 위치 표시

### 3. 스크롤 오프셋 고려
- 스크롤된 상태에서도 정확한 위치 계산
- 부모 요소를 따라 올라가며 스크롤 컨테이너 찾기

### 4. 드래그 지원
- 마우스 다운 → 드래그 → 업으로 플레이헤드 이동
- 전역 이벤트 리스너로 부드러운 드래그 경험

## 파일 구조

```
src/components/DAW/Ruler/
├── Ruler.tsx              # 메인 Ruler 컴포넌트
├── Ruler.css.ts           # Ruler 스타일
├── RulerWrapper.tsx       # Ruler 래퍼 컴포넌트
└── RulerWrapper.css.ts   # RulerWrapper 스타일
```

## 타입 정의

```typescript
// src/types/daw.ts

export type RulerMarkerType = 'bar' | 'beat';

export interface RulerMarker {
  type: RulerMarkerType;
  time: number;              // 초 단위
  barNumber?: number;        // 마디 번호 (bar 타입만)
}

export interface RulerProps {
  bpm: number;
  timelineDuration?: number;
  playheadRef?: RefObject<HTMLDivElement>;
  onRulerClick?: (positionSeconds: number) => void;
  pixelsPerSecond?: number;
}

export interface RulerWrapperProps {
  bpm: number;
  playheadRef?: RefObject<HTMLDivElement>;
  timelineDuration?: number;
  onRulerClick?: (positionSeconds: number) => void;
  pixelsPerSecond?: number;
}
```


