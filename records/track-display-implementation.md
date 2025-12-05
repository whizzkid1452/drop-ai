# 트랙 표시 기능 구현 작업 기록

## 작업 개요

업로드된 오디오 파일을 DAW 페이지에서 트랙으로 표시하는 기능을 구현했습니다. Context API를 사용하여 라우트 간 상태 공유를 구현하고, 각 트랙을 독립적으로 관리할 수 있는 UI를 제공합니다.

### 구현 데모

<video controls width="100%">
  <source src="./media/track-display-implementation.mp4" type="video/mp4">
  브라우저가 비디오 태그를 지원하지 않습니다.
</video>

## 파일 구조

```
src/
├── contexts/
│   └── TrackContext.tsx          # 트랙 전역 상태 관리 Context
├── components/
│   ├── Daw/
│   │   ├── DawPage.tsx            # DAW 메인 페이지
│   │   ├── DawPage.css.ts         # DAW 페이지 스타일
│   │   └── components/
│   │       └── Track/
│   │           ├── Track.tsx       # 개별 트랙 컴포넌트
│   │           └── Track.css.ts   # 트랙 스타일
│   └── DropZone/
│       └── DropZonePage.tsx       # 파일 업로드 시 트랙 추가 로직
└── App.tsx                         # TrackProvider 추가
```

## 주요 기능

### 1. 전역 상태 관리 (TrackContext)

- **목적**: 서로 다른 라우트(`/dropzone`, `/daw`) 간 트랙 데이터 공유
- **구현 방식**: React Context API 사용
- **제공 기능**:
  - `tracks`: 현재 등록된 모든 트랙 목록
  - `addTrack`: 새로운 트랙 추가
  - `removeTrack`: 특정 인덱스의 트랙 제거
  - `clearTracks`: 모든 트랙 제거
- **메모리 관리**: Object URL 자동 해제로 메모리 누수 방지

### 2. 트랙 표시 (DawPage)

- 업로드된 파일들을 트랙 리스트로 표시
- 트랙이 없을 때 빈 상태(Empty State) 메시지 표시
- 트랙 개수 표시

### 3. 개별 트랙 컴포넌트 (Track)

- **트랙 정보 표시**:
  - 트랙 번호 (1부터 시작)
  - 파일명
  - 재생 시간 (분:초 형식)
  - 파일 크기 (B/KB/MB 자동 변환)
- **오디오 재생**: HTML5 audio 요소를 통한 오디오 재생
- **트랙 제거**: 제거 버튼을 통한 개별 트랙 삭제

## 구현 세부사항

### 1. TrackContext 구현 (`src/contexts/TrackContext.tsx`)

#### Context 생성

```typescript
interface TrackContextValue {
  tracks: AudioFile[];
  addTrack: (file: AudioFile) => void;
  removeTrack: (index: number) => void;
  clearTracks: () => void;
}

const TrackContext = createContext<TrackContextValue | undefined>(undefined);
```

#### TrackProvider 컴포넌트

```typescript
export function TrackProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<AudioFile[]>([]);

  // 트랙 추가
  const addTrack = useCallback((file: AudioFile) => {
    setTracks((prev) => [...prev, file]);
  }, []);

  // 트랙 제거 (메모리 정리 포함)
  const removeTrack = useCallback((index: number) => {
    setTracks((prev) => {
      const newTracks = [...prev];
      if (newTracks[index]?.url) {
        URL.revokeObjectURL(newTracks[index].url);
      }
      newTracks.splice(index, 1);
      return newTracks;
    });
  }, []);

  // 모든 트랙 제거
  const clearTracks = useCallback(() => {
    tracks.forEach((track) => {
      if (track.url) {
        URL.revokeObjectURL(track.url);
      }
    });
    setTracks([]);
  }, [tracks]);

  return (
    <TrackContext.Provider value={{ tracks, addTrack, removeTrack, clearTracks }}>
      {children}
    </TrackContext.Provider>
  );
}
```

#### useTracks 커스텀 훅

```typescript
export function useTracks() {
  const context = useContext(TrackContext);
  if (context === undefined) {
    throw new Error('useTracks must be used within a TrackProvider');
  }
  return context;
}
```

### 2. DawPage 구현 (`src/components/Daw/DawPage.tsx`)

```typescript
export function DawPage() {
  const { tracks, removeTrack } = useTracks();

  // 빈 상태 처리
  if (tracks.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2 className={styles.emptyTitle}>트랙이 없습니다</h2>
          <p className={styles.emptyMessage}>
            파일을 업로드하면 여기에 트랙이 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  // 트랙 리스트 표시
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>트랙 목록</h1>
        <span className={styles.trackCount}>{tracks.length}개 트랙</span>
      </div>
      <div className={styles.trackList}>
        {tracks.map((track, index) => (
          <Track
            key={`${track.name}-${index}`}
            track={track}
            index={index}
            onRemove={removeTrack}
          />
        ))}
      </div>
    </div>
  );
}
```

### 3. Track 컴포넌트 구현 (`src/components/Daw/components/Track/Track.tsx`)

#### 유틸리티 함수

```typescript
// 재생 시간 포맷팅 (초 → "분:초")
const formatDuration = (seconds?: number) => {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 파일 크기 포맷팅 (바이트 → B/KB/MB)
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
```

#### 컴포넌트 구조

```typescript
export function Track({ track, index, onRemove }: TrackProps) {
  return (
    <div className={styles.track}>
      {/* 트랙 헤더: 정보 + 제거 버튼 */}
      <div className={styles.trackHeader}>
        <div className={styles.trackInfo}>
          <span className={styles.trackNumber}>{index + 1}</span>
          <div className={styles.trackDetails}>
            <span className={styles.trackName}>{track.name}</span>
            <span className={styles.trackMeta}>
              {formatDuration(track.duration)} • {formatFileSize(track.size)}
            </span>
          </div>
        </div>
        {onRemove && (
          <button onClick={() => onRemove(index)}>×</button>
        )}
      </div>

      {/* 오디오 플레이어 */}
      <div className={styles.trackContent}>
        <audio controls src={track.url} />
      </div>
    </div>
  );
}
```

### 4. DropZonePage 수정 (`src/components/DropZone/DropZonePage.tsx`)

파일 업로드 시 자동으로 트랙에 추가:

```typescript
export function DropZonePage() {
  const { addTrack } = useTracks();

  const handleFileUploaded = (file: AudioFile) => {
    console.log('File uploaded:', file);
    addTrack(file); // 트랙 컨텍스트에 추가
  };

  return (
    <div>
      <FileUpload onFileUploaded={handleFileUploaded} />
    </div>
  );
}
```

### 5. App.tsx 수정

전역 Provider 추가:

```typescript
import { TrackProvider } from './contexts/TrackContext';

function App() {
  return (
    <BrowserRouter>
      <TrackProvider>
        <AppRouter />
      </TrackProvider>
    </BrowserRouter>
  );
}
```

## 설계 결정 사항

### Context API 선택 이유

1. **라우트 간 상태 공유 필요**
   - `DropZonePage` (`/dropzone`)와 `DawPage` (`/daw`)는 서로 다른 라우트
   - Props drilling으로는 공통 부모가 없어 전달 불가능

2. **단순한 상태 관리 요구사항**
   - 복잡한 비동기 로직이나 미들웨어 불필요
   - Context API로 충분한 기능 제공

3. **React 기본 제공 솔루션**
   - 추가 라이브러리 불필요 (Redux, Zustand 등)
   - 번들 크기 증가 없음

4. **메모리 관리 통합**
   - Object URL 정리 로직을 Context에 통합
   - 메모리 누수 방지 로직을 한 곳에서 관리

## 레퍼런스 분석: Ardour의 트랙 관리 방식

### Ardour의 아키텍처

Ardour는 데스크톱 DAW 애플리케이션으로, GTK+ 기반 GUI와 C++ 백엔드를 사용합니다. 트랙 관리는 다음과 같은 구조로 이루어집니다:

#### 1. 트랙 클래스 계층 구조

**Track 클래스** (`libs/ardour/ardour/track.h`)

```cpp
/**
 * Track는 Route와 Recordable을 상속받는 클래스입니다.
 * - Route: 신호 라우팅 및 믹싱 기능
 * - Recordable: 녹음 기능
 */
class LIBARDOUR_API Track : public Route, public Recordable
{
public:
    Track (Session&, std::string name, PresentationInfo::Flag f,
           TrackMode m, DataType default_type);

    // 트랙 이름 설정
    bool set_name (const std::string& str);

    // 녹음 관련
    bool can_record();
    int prep_record_enabled (bool);

    // Playlist 관리
    std::shared_ptr<Playlist> playlist ();
    int use_playlist (DataType, std::shared_ptr<Playlist>, bool set_orig = true);
    int use_new_playlist (DataType);

    // Bounce 기능
    virtual std::shared_ptr<Region> bounce (InterThreadInfo& itt,
                                             std::string const& name);
    virtual std::shared_ptr<Region> bounce_range (samplepos_t start,
                                                   samplepos_t end, ...);

    // Signal (이벤트)
    PBD::Signal<void()> PlaylistChanged;
    PBD::Signal<void()> PlaylistAdded;
    PBD::Signal<void()> SpeedChanged;
};
```

**주요 특징:**

- **상속 구조**: Route와 Recordable을 다중 상속하여 라우팅과 녹음 기능 통합
- **Playlist 관리**: 각 트랙은 하나 이상의 Playlist를 가질 수 있음
- **Signal 기반 이벤트**: PBD::Signal을 사용한 이벤트 시스템
- **스레드 안전성**: InterThreadInfo를 통한 비동기 작업 지원

#### 2. Session 클래스의 트랙 관리

**트랙 컨테이너** (`libs/ardour/ardour/session.h`)

```cpp
class LIBARDOUR_API Session {
public:
    // 트랙 생성
    RouteList new_audio_route (int input_channels, int output_channels,
                                RouteGroup* route_group, uint32_t how_many,
                                std::string name_template,
                                PresentationInfo::Flag,
                                PresentationInfo::order_t);

    RouteList new_midi_route (RouteGroup* route_group, uint32_t how_many,
                              std::string name_template, bool strict_io,
                              std::shared_ptr<PluginInfo> instrument, ...);

    // 트랙 조회
    std::shared_ptr<RouteList> get_tracks() const;
    RouteList get_routelist (bool mixer_order = false,
                            PresentationInfo::Flag fl = ...) const;

    // 트랙 제거
    void remove_routes (std::shared_ptr<RouteList>);
    void remove_route (std::shared_ptr<Route>);

    // 트랙 순서 변경
    void resort_routes ();

    // 트랙 개수
    uint32_t ntracks () const;
    uint32_t naudiotracks () const;

    // 이벤트
    PBD::Signal<void(RouteList&)> RouteAdded;
    PBD::Signal<void(RouteList&)> InstrumentRouteAdded;

private:
    // RCU (Read-Copy-Update) 패턴을 사용한 스레드 안전 컨테이너
    SerializedRCUManager<RouteList> routes;

    void add_routes (RouteList&, bool input_auto_connect,
                     bool output_auto_connect, PresentationInfo::order_t);
};
```

**주요 특징:**

- **RouteList 컨테이너**: 모든 트랙을 RouteList로 관리 (Track는 Route의 서브클래스)
- **RCU 패턴**: `SerializedRCUManager`를 사용한 스레드 안전한 읽기/쓰기
- **템플릿 기반 생성**: `new_route_from_template`으로 템플릿에서 트랙 생성 가능
- **자동 연결**: `input_auto_connect`, `output_auto_connect`로 자동 I/O 연결

#### 3. GUI 레이어의 트랙 뷰 관리

**TrackViewList** (`gtk2_ardour/track_view_list.h`)

```cpp
/**
 * GUI에서 트랙 뷰를 관리하는 리스트 클래스
 * std::list<TimeAxisView*>를 상속받음
 */
class TrackViewList : public std::list<TimeAxisView*>
{
public:
    TrackViewList ();
    TrackViewList (std::list<TimeAxisView*> const &);

    // 트랙 뷰 추가
    virtual TrackViewList add (TrackViewList const &);

    // 포함 여부 확인
    bool contains (TimeAxisView const *) const;

    // RouteList로 변환
    ARDOUR::RouteList routelist () const;

    // 템플릿 함수: 각 타입별 반복 처리
    template <typename Function>
    void foreach_time_axis (Function f);

    template <typename Function>
    void foreach_audio_time_axis (Function f);

    template <typename Function>
    void foreach_midi_time_axis (Function f);
};
```

**구현 예시** (`gtk2_ardour/track_view_list.cc`)

```cpp
ARDOUR::RouteList
TrackViewList::routelist () const
{
    ARDOUR::RouteList rl;
    for (TrackViewList::const_iterator i = begin (); i != end (); ++i) {
        RouteTimeAxisView* rtv = dynamic_cast<RouteTimeAxisView*> (*i);
        if (rtv) {
            rl.push_back (rtv->route ());
        }
    }
    return rl;
}
```

**주요 특징:**

- **GUI와 백엔드 분리**: TrackViewList는 GUI 레이어, RouteList는 백엔드 레이어
- **타입 안전성**: dynamic_cast를 사용한 타입 변환
- **템플릿 기반 반복**: 다양한 타입의 트랙 뷰를 처리하는 템플릿 함수

#### 4. 트랙 생성 및 관리 플로우

**트랙 생성 과정:**

1. **템플릿 또는 파라미터로 트랙 생성**

   ```cpp
   RouteList tracks = session->new_audio_route(
       input_channels, output_channels, route_group,
       how_many, name_template, flags, insert_at
   );
   ```

2. **Session에 트랙 추가**

   ```cpp
   session->add_routes(tracks, input_auto_connect,
                      output_auto_connect, insert_at);
   ```

3. **이벤트 발생**

   ```cpp
   RouteAdded.emit(tracks);  // Signal 발생
   ```

4. **GUI 업데이트**
   - GUI 레이어가 RouteAdded Signal을 수신
   - TrackViewList에 새로운 TimeAxisView 추가
   - 화면에 트랙 표시

**트랙 제거 과정:**

1. **트랙 선택**

   ```cpp
   std::shared_ptr<RouteList> tracks_to_remove = ...;
   ```

2. **Session에서 제거**

   ```cpp
   session->remove_routes(tracks_to_remove);
   ```

3. **리소스 정리**
   - Playlist 정리
   - Source 파일 정리 (선택적)
   - Signal 연결 해제

#### 5. Ardour의 트랙 데이터 구조

**트랙 정보 저장:**

```cpp
class Track {
    // Playlist 배열 (오디오/미디 타입별)
    std::shared_ptr<Playlist> _playlists[DataType::num_types];

    // 녹음 관련 컨트롤
    std::shared_ptr<AutomationControl> _record_enable_control;
    std::shared_ptr<AutomationControl> _record_safe_control;

    // 디스크 I/O
    std::shared_ptr<DiskReader> _disk_reader;
    std::shared_ptr<DiskWriter> _disk_writer;

    // 마지막 캡처 소스
    std::list<std::shared_ptr<Source> > _last_capture_sources;
};
```

**세션 파일 저장:**

- XML 기반 세션 파일에 트랙 정보 저장
- 각 트랙의 Playlist, Processor, Automation 정보 포함
- Source 파일 경로는 세션 디렉토리 기준 상대 경로

### 현재 프로젝트와의 비교

| 항목              | Ardour (레퍼런스)                   | 현재 프로젝트             |
| ----------------- | ----------------------------------- | ------------------------- |
| **플랫폼**        | 데스크톱 (C++/GTK+)                 | 웹 (React/TypeScript)     |
| **상태 관리**     | Session 객체 (C++)                  | Context API (React)       |
| **트랙 저장**     | 디스크 기반 세션 파일 (XML)         | 메모리 기반 (Object URL)  |
| **트랙 표시**     | GTK+ 위젯 (TrackViewList)           | React 컴포넌트 (Track)    |
| **트랙 제어**     | Session 메서드                      | Context 함수              |
| **트랙 컨테이너** | RouteList (std::list)               | tracks 배열 (AudioFile[]) |
| **스레드 안전성** | RCU 패턴 (SerializedRCUManager)     | 단일 스레드 (React)       |
| **이벤트 시스템** | PBD::Signal                         | React 상태 업데이트       |
| **트랙 타입**     | AudioTrack, MidiTrack (클래스 상속) | AudioFile (단일 타입)     |
| **Playlist 관리** | 각 트랙별 Playlist 객체             | 단일 파일 (AudioFile)     |
| **트랙 생성**     | new_audio_route(), new_midi_route() | addTrack()                |
| **트랙 제거**     | remove_routes()                     | removeTrack()             |

### Ardour에서 참고할 수 있는 설계 패턴

#### 1. **컨테이너 패턴**

Ardour는 `RouteList`를 사용하여 트랙을 관리합니다. 현재 프로젝트도 배열을 사용하지만, 향후 확장 시 다음과 같은 패턴을 고려할 수 있습니다:

```typescript
// 향후 확장 가능한 구조
interface TrackList {
  tracks: Track[];
  add(track: Track): void;
  remove(index: number): void;
  getByIndex(index: number): Track | undefined;
  getByName(name: string): Track | undefined;
  filter(predicate: (track: Track) => boolean): Track[];
}
```

#### 2. **이벤트 시스템**

Ardour의 Signal 시스템을 참고하여, 향후 이벤트 기반 아키텍처를 도입할 수 있습니다:

```typescript
// 향후 확장 가능한 이벤트 시스템
interface TrackEvents {
  onTrackAdded: (track: AudioFile) => void;
  onTrackRemoved: (index: number) => void;
  onTrackChanged: (index: number, track: AudioFile) => void;
}
```

#### 3. **타입별 트랙 관리**

Ardour는 AudioTrack와 MidiTrack를 구분합니다. 현재 프로젝트도 향후 확장 시 타입별 관리가 필요할 수 있습니다:

```typescript
// 향후 확장 가능한 타입 시스템
type TrackType = 'audio' | 'midi' | 'video';

interface TypedTrack extends AudioFile {
  type: TrackType;
  // 타입별 추가 속성
}
```

#### 4. **Playlist 개념**

Ardour의 Playlist 개념은 현재 프로젝트의 단일 파일 구조와 다르지만, 향후 여러 Region을 관리할 때 참고할 수 있습니다:

```typescript
// 향후 확장 가능한 Region 시스템
interface Region {
  id: string;
  startTime: number;
  endTime: number;
  source: AudioFile;
}

interface TrackWithRegions extends AudioFile {
  regions: Region[];
  activeRegion?: Region;
}
```

## 기술 스택

- **React**: v18.3.1
- **TypeScript**: ~5.8.3
- **Context API**: React 기본 제공
- **Vanilla Extract**: CSS-in-TS 스타일링

## 주요 특징

### 1. 메모리 관리

- Object URL 자동 해제로 메모리 누수 방지
- 트랙 제거 시 즉시 메모리 정리

### 2. 타입 안정성

- TypeScript로 모든 타입 정의
- Context 사용 시 타입 체크

### 3. 사용자 경험

- 빈 상태 메시지로 명확한 안내
- 트랙 개수 실시간 표시
- 직관적인 트랙 제거 UI

### 4. 확장성

- 트랙 관리 로직이 Context에 집중되어 확장 용이
- 새로운 트랙 기능 추가 시 Context만 수정

## 향후 개선 사항

- [ ] 트랙 순서 변경 기능 (드래그 앤 드롭)
- [ ] 트랙 이름 편집 기능
- [ ] 트랙별 볼륨 제어 (spec.md p1)
- [ ] 트랙별 패닝 제어 (spec.md p2)
- [ ] 트랙 솔로/뮤트 기능 (spec.md p2)
- [ ] 트랙 파형 표시 (spec.md p2)
- [ ] 트랙 상태 영구 저장 (LocalStorage/IndexedDB)
- [ ] 트랙 복제 기능

## 관련 문서

- [FileUpload 구현 기록](./file-upload-implementation.md)
- [Router 설정 기록](./router-setup.md)
- [Spec 문서](../spec.md)
