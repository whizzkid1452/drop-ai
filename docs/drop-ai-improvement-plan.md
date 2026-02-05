# drop.ai 개선 계획: 모듈화, 추상화, 도메인 중심 설계

## 현재 문제점 분석

### 1. AudioService의 과도한 책임 (God Object)

**현재 상태:**
```typescript
// AudioService.ts (500줄)
class AudioService {
    // 도메인 관리
    private session: Session;
    
    // 엔진 관리
    private channels: Map<string, Tone.Channel>;
    private players: Map<string, Map<string, Tone.Player>>;
    
    // 상태 관리
    public store: Store<AudioSnapshot>;
    
    // 모든 메서드가 여기에...
    play(), pause(), stop(), addRegion(), removeRegion(), 
    splitRegion(), exportProject(), setTrackVolume(), ...
}
```

**문제점:**
- 단일 클래스가 너무 많은 책임을 가짐
- 테스트하기 어려움
- 변경 시 영향 범위가 큼
- Export 로직이 100줄 이상 포함

### 2. Tone.js에 직접 의존

**현재 상태:**
```typescript
// AudioService가 Tone.js에 강하게 결합
private channels: Map<string, Tone.Channel>;
private players: Map<string, Map<string, Tone.Player>>;

// 다른 백엔드로 교체 불가능
```

**문제점:**
- 다른 오디오 엔진으로 교체 불가능
- 테스트 시 실제 Tone.js 필요
- 플랫폼별 최적화 어려움

### 3. 도메인 모델이 빈약함

**현재 상태:**
```typescript
// Region.ts - 기본적인 CRUD만 제공
class Region {
    split(sysTime: number): { left: Region; right: Region } | null;
    toSnapshot(): RegionData;
}

// Track.ts - 기본적인 CRUD만 제공
class Track {
    addRegion(region: Region);
    removeRegion(regionId: string);
}
```

**문제점:**
- 비즈니스 로직이 AudioService에 있음
- 도메인 규칙 검증이 부족
- 리전 겹침 검사 등이 없음

### 4. logics/audio가 혼재

**현재 상태:**
```
logics/audio/
├── playerConfig.ts      # Tone.js 설정
├── regionRenderer.ts    # 렌더링 계산
├── loadAndDecodeAudioBuffer.ts  # 파일 로딩
├── audioEngine.errors.ts  # 에러 처리
└── useAudioCommand.ts   # React 훅
```

**문제점:**
- 책임이 명확하지 않음
- 모듈 간 경계가 불명확
- 재사용성 낮음

---

## 개선 계획

### Phase 1: 백엔드 추상화 (우선순위: 높음)

#### 1.1 AudioBackend 인터페이스 정의

**목표:** Tone.js 의존성을 추상화하여 다른 백엔드로 교체 가능하게 만들기

**구현:**

```typescript
// core/audio/backend/AudioBackend.ts
export interface AudioChannel {
    setVolume(volume: number): void;
    setPan(pan: number): void;
    connect(destination: AudioDestination): void;
    disconnect(): void;
}

export interface AudioPlayer {
    load(url: string): Promise<void>;
    start(time: number, offset?: number, duration?: number): void;
    stop(): void;
    setLoop(start: number, end: number): void;
    connect(channel: AudioChannel): void;
    disconnect(): void;
    dispose(): void;
    getDuration(): number;
}

export interface AudioTransport {
    start(): Promise<void>;
    pause(): void;
    stop(): void;
    setTime(time: number): void;
    getTime(): number;
    getState(): 'started' | 'paused' | 'stopped';
    setBPM(bpm: number): void;
}

export interface AudioBackend {
    createChannel(id: string): AudioChannel;
    createPlayer(id: string): AudioPlayer;
    getTransport(): AudioTransport;
    getContext(): AudioContext;
}
```

#### 1.2 ToneBackend 구현

```typescript
// infrastructure/audio/ToneBackend.ts
import * as Tone from 'tone';
import type { AudioBackend, AudioChannel, AudioPlayer, AudioTransport } from '@/core/audio/backend/AudioBackend';

export class ToneChannel implements AudioChannel {
    constructor(private channel: Tone.Channel) {}
    
    setVolume(volume: number): void {
        const volumeInDb = Tone.gainToDb(volume);
        this.channel.volume.rampTo(volumeInDb, 0.1);
    }
    
    setPan(pan: number): void {
        this.channel.pan.rampTo(pan, 0.1);
    }
    
    // ... 나머지 구현
}

export class ToneBackend implements AudioBackend {
    createChannel(id: string): AudioChannel {
        const channel = new Tone.Channel().toDestination();
        return new ToneChannel(channel);
    }
    
    createPlayer(id: string): AudioPlayer {
        // TonePlayer 구현
    }
    
    getTransport(): AudioTransport {
        // ToneTransport 구현
    }
    
    getContext(): AudioContext {
        return Tone.getContext();
    }
}
```

#### 1.3 AudioService 리팩토링

```typescript
// core/audio/AudioService.ts (수정 후)
export class AudioService {
    private backend: AudioBackend;  // 인터페이스에 의존
    
    constructor(
        private session: Session,
        backend?: AudioBackend  // 의존성 주입
    ) {
        this.backend = backend ?? new ToneBackend();  // 기본값
    }
    
    // Tone.js 직접 사용 제거
    private channels: Map<string, AudioChannel> = new Map();
    private players: Map<string, Map<string, AudioPlayer>> = new Map();
}
```

**장점:**
- ✅ 다른 백엔드로 교체 가능 (예: Web Audio API 직접 사용)
- ✅ 테스트 시 Mock Backend 사용 가능
- ✅ 플랫폼별 최적화 가능

---

### Phase 2: Export 로직 분리 (우선순위: 높음)

#### 2.1 AudioExporter 클래스 생성

**목표:** Export 로직을 AudioService에서 분리

**구현:**

```typescript
// core/audio/export/AudioExporter.ts
export class AudioExporter {
    constructor(
        private backend: AudioBackend,
        private session: Session
    ) {}
    
    async exportProject(options: ExportOptions): Promise<Blob> {
        // Export 로직 전체를 여기로 이동
        // AudioService에서 분리된 순수한 Export 책임
    }
    
    private async preloadBuffers(tracks: TrackData[]): Promise<Map<string, AudioBuffer>> {
        // 버퍼 프리로드 로직
    }
    
    private calculateDuration(tracks: TrackData[], range?: ExportRange): number {
        // Duration 계산 로직
    }
}
```

#### 2.2 AudioService에서 사용

```typescript
// core/audio/AudioService.ts (수정 후)
export class AudioService {
    private exporter: AudioExporter;
    
    constructor(
        private session: Session,
        backend?: AudioBackend
    ) {
        this.backend = backend ?? new ToneBackend();
        this.exporter = new AudioExporter(this.backend, this.session);
    }
    
    async exportProject(options?: ExportOptions): Promise<Blob> {
        return this.exporter.exportProject(options);
    }
}
```

**장점:**
- ✅ AudioService 책임 감소 (500줄 → 300줄)
- ✅ Export 로직 독립 테스트 가능
- ✅ Export 전략 교체 가능 (예: 스트리밍 Export)

---

### Phase 3: 도메인 모델 강화 (우선순위: 중간)

#### 3.1 Region 도메인 로직 강화

**현재:**
```typescript
class Region {
    split(sysTime: number): { left: Region; right: Region } | null;
}
```

**개선:**
```typescript
// core/region/Region.ts (개선 후)
export class Region {
    // 리전 겹침 검사
    overlaps(other: Region): boolean {
        return !(
            this.endTime <= other.startTime || 
            this.startTime >= other.endTime
        );
    }
    
    // 리전이 특정 시간을 포함하는지
    contains(time: number): boolean {
        return time >= this.startTime && time < this.endTime;
    }
    
    // 리전 이동 (도메인 규칙 검증)
    moveTo(newStartTime: number): void {
        if (newStartTime < 0) {
            throw new Error('Region start time cannot be negative');
        }
        this.startTime = newStartTime;
    }
    
    // 리전 길이 변경 (도메인 규칙 검증)
    resize(newDuration: number): void {
        if (newDuration <= 0) {
            throw new Error('Region duration must be positive');
        }
        if (this.audioFile && newDuration > this.audioFile.duration) {
            throw new Error('Region duration cannot exceed audio file duration');
        }
        this.duration = newDuration;
    }
}
```

#### 3.2 Track 도메인 로직 강화

**현재:**
```typescript
class Track {
    addRegion(region: Region);
    removeRegion(regionId: string);
}
```

**개선:**
```typescript
// core/track/Track.ts (개선 후)
export class Track {
    // 리전 추가 시 겹침 검사
    addRegion(region: Region): void {
        // 겹침 검사
        const overlapping = this.regions.find(r => r.overlaps(region));
        if (overlapping) {
            throw new Error(`Region overlaps with existing region: ${overlapping.id}`);
        }
        
        this._regions.set(region.id, region);
    }
    
    // 특정 시간의 리전 찾기
    getRegionAtTime(time: number): Region | null {
        return this.regions.find(r => r.contains(time)) ?? null;
    }
    
    // 리전 목록 정렬 (타임라인 순서)
    getSortedRegions(): Region[] {
        return [...this.regions].sort((a, b) => a.startTime - b.startTime);
    }
    
    // 볼륨 변환 (dB ↔ Linear)
    static linearToDb(linear: number): number {
        return linear > 0 ? 20 * Math.log10(linear) : -Infinity;
    }
    
    static dbToLinear(db: number): number {
        return db > -Infinity ? Math.pow(10, db / 20) : 0;
    }
}
```

**장점:**
- ✅ 비즈니스 로직이 도메인에 집중
- ✅ 불변성 보장 (겹침 방지 등)
- ✅ 테스트 용이성 향상

---

### Phase 4: 모듈화 강화 (우선순위: 중간)

#### 4.1 logics/audio 재구성

**현재 구조:**
```
logics/audio/
├── playerConfig.ts
├── regionRenderer.ts
├── loadAndDecodeAudioBuffer.ts
└── useAudioCommand.ts
```

**개선 구조:**
```
core/
├── audio/
│   ├── backend/          # 백엔드 추상화
│   │   ├── AudioBackend.ts
│   │   └── ToneBackend.ts
│   ├── export/           # Export 로직
│   │   ├── AudioExporter.ts
│   │   └── ExportOptions.ts
│   ├── renderer/          # 렌더링 계산
│   │   └── RegionRenderer.ts (이동)
│   └── AudioService.ts    # 통합 서비스
├── time/                  # 시간 처리 (신규)
│   ├── TimeConverter.ts
│   └── TempoMap.ts
└── events/                # 이벤트 처리 (신규)
    └── Automation.ts

infrastructure/
├── audio/
│   ├── ToneBackend.ts     # Tone.js 구현
│   └── AudioFileLoader.ts  # 파일 로딩
└── storage/
    └── SessionStorage.ts

presentation/
├── hooks/
│   ├── useAudioService.ts
│   └── useAudioCommand.ts (이동)
└── stores/
    └── audioStore.ts      # Store는 presentation 레이어
```

#### 4.2 시간 처리 모듈 추가

```typescript
// core/time/TimeConverter.ts
export class TimeConverter {
    /**
     * 초를 비트로 변환
     */
    static secondsToBeats(seconds: number, bpm: number): number {
        return (seconds * bpm) / 60;
    }
    
    /**
     * 비트를 초로 변환
     */
    static beatsToSeconds(beats: number, bpm: number): number {
        return (beats * 60) / bpm;
    }
    
    /**
     * 시간 포맷팅 (예: "1:23.45")
     */
    static formatTime(seconds: number): string {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toFixed(2)}`;
    }
}
```

#### 4.3 이벤트 처리 모듈 추가

```typescript
// core/events/Automation.ts
export class Automation {
    /**
     * 특정 시간의 자동화 값 계산
     */
    static getValueAtTime(
        automationPoints: AutomationPoint[],
        time: number
    ): number {
        // 선형 보간 등
    }
}
```

**장점:**
- ✅ 명확한 책임 분리
- ✅ 재사용성 향상
- ✅ 테스트 용이성 향상

---

### Phase 5: 상태 동기화 개선 (우선순위: 낮음)

#### 5.1 Observer 패턴 적용

**현재:**
```typescript
// 수동 동기화
syncStore() {
    this.store.setState({
        tracks: this.session.tracks.map(t => t.toSnapshot())
    });
}
```

**개선:**
```typescript
// core/session/Session.ts (개선 후)
export class Session {
    private observers: Array<(session: Session) => void> = [];
    
    addObserver(observer: (session: Session) => void): void {
        this.observers.push(observer);
    }
    
    private notifyObservers(): void {
        this.observers.forEach(obs => obs(this));
    }
    
    addTrack(track: Track): void {
        this._tracks.set(track.id, track);
        this.notifyObservers();  // 자동 알림
    }
}

// core/audio/AudioService.ts (개선 후)
export class AudioService {
    constructor(private session: Session) {
        // Session 변경 시 자동 동기화
        this.session.addObserver(() => {
            this.syncStore();
        });
    }
}
```

**장점:**
- ✅ 수동 동기화 제거
- ✅ 실수 방지
- ✅ 자동화

---

## 구현 우선순위

### 즉시 적용 가능 (Quick Wins)

1. **Export 로직 분리** (1-2일)
   - `AudioExporter` 클래스 생성
   - AudioService에서 Export 메서드 이동
   - 즉각적인 코드 가독성 향상

2. **도메인 모델 강화** (2-3일)
   - Region/Track에 비즈니스 로직 추가
   - 겹침 검사, 유효성 검증 등
   - 도메인 규칙 명확화

### 단기 개선 (1-2주)

3. **백엔드 추상화** (3-5일)
   - `AudioBackend` 인터페이스 정의
   - `ToneBackend` 구현
   - AudioService 리팩토링

4. **모듈화 강화** (3-5일)
   - `core/time` 모듈 추가
   - `core/events` 모듈 추가
   - `logics/audio` 재구성

### 중장기 개선 (1-2개월)

5. **Observer 패턴 적용** (2-3일)
   - Session에 Observer 추가
   - 자동 상태 동기화

6. **테스트 추가** (지속적)
   - 각 모듈별 단위 테스트
   - 통합 테스트

---

## 단계별 마이그레이션 전략

### Step 1: Export 분리 (가장 쉬움)

```typescript
// 1. AudioExporter.ts 생성
export class AudioExporter { ... }

// 2. AudioService에서 사용
async exportProject(options?: ExportOptions): Promise<Blob> {
    return this.exporter.exportProject(options);
}

// 3. 기존 코드는 그대로 동작 (호환성 유지)
```

### Step 2: 백엔드 추상화 (점진적)

```typescript
// 1. 인터페이스 정의
export interface AudioBackend { ... }

// 2. ToneBackend 구현
export class ToneBackend implements AudioBackend { ... }

// 3. AudioService에 주입 (기본값 제공)
constructor(backend?: AudioBackend) {
    this.backend = backend ?? new ToneBackend();
}

// 4. 기존 코드는 그대로 동작
```

### Step 3: 도메인 강화 (점진적)

```typescript
// 1. Region에 메서드 추가 (기존 메서드 유지)
class Region {
    overlaps(other: Region): boolean { ... }
    // 기존 split() 메서드 유지
}

// 2. AudioService에서 도메인 메서드 사용
addRegion(...) {
    // 도메인 검증 사용
    if (track.regions.some(r => r.overlaps(region))) {
        throw new Error('Region overlaps');
    }
}
```

---

## 예상 효과

### 코드 품질

- **가독성**: AudioService 500줄 → 300줄
- **테스트 용이성**: 각 모듈 독립 테스트 가능
- **유지보수성**: 변경 영향 범위 축소

### 확장성

- **백엔드 교체**: 다른 오디오 엔진으로 교체 가능
- **기능 추가**: 모듈별 독립적 확장
- **플랫폼 지원**: 플랫폼별 백엔드 구현 가능

### 개발 생산성

- **병렬 개발**: 모듈별 독립 개발 가능
- **버그 격리**: 문제 발생 시 영향 범위 명확
- **리팩토링**: 안전한 리팩토링 가능

---

## 결론

현재 drop.ai의 구조는 **서비스 중심 아키텍처**로 빠른 개발에는 유리하지만, 확장성과 유지보수성 측면에서 개선이 필요합니다.

**즉시 적용 가능한 개선:**
1. Export 로직 분리 (가장 쉬움, 즉각적 효과)
2. 도메인 모델 강화 (비즈니스 로직 명확화)

**단기 개선:**
3. 백엔드 추상화 (확장성 향상)
4. 모듈화 강화 (재사용성 향상)

이러한 개선을 통해 **Ardour 수준의 모듈화와 추상화**를 달성하면서도, **웹 환경에 최적화된 구조**를 유지할 수 있습니다.
