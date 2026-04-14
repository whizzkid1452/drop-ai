# Ardour DAW Architecture Reference

> 분석 기준: `reference/ardour/` 소스코드 | C++ / GTK2 / WAF 빌드

---

## 1. 개요

Ardour는 프로페셔널 오픈소스 DAW(C++). 오디오/MIDI 녹음, 편집, 믹싱, 마스터링을 지원하며 리눅스, macOS, Windows에서 동작한다.

| 항목 | 스택 |
|------|------|
| 언어 | C++ (C++11+) |
| UI | GTK2 / Gtkmm2 (커스텀 번들 TK) |
| 오디오 | JACK, ALSA, CoreAudio, PortAudio, PulseAudio |
| 플러그인 | LV2, VST2/3, AU, LADSPA |
| 빌드 | WAF (Python 기반) |
| 스크립팅 | Lua 5.3 (LuaBridge) |
| 라이선스 | GPL v2 |

---

## 2. 최상위 디렉토리 구조

```
ardour/
├── gtk2_ardour/       # GUI 프론트엔드 (GTK2/Gtkmm)
├── libs/              # 내부/외부 라이브러리 모음 (핵심)
├── headless/          # GUI 없는 헤드리스 실행기
├── session_utils/     # 커맨드라인 세션 유틸 (export 등)
├── luasession/        # Lua CLI 인터페이스 (arlua)
├── share/             # 리소스 파일 (export 포맷, MIDI 맵, 템플릿, 스크립트)
├── doc/               # 개발자 문서, Doxygen, 아키텍처 다이어그램
├── tools/             # 개발/패키징 도구
├── wscript            # WAF 빌드 설정 (메인)
└── waf                # WAF 빌드 시스템
```

---

## 3. 라이브러리 계층 구조

### 3.1 의존성 방향 (아래 → 위)

```
┌─────────────────────────────────────────────┐
│  gtk2_ardour (UI)                           │  ← Editor, Mixer, Dialogs
├─────────────────────────────────────────────┤
│  libardour (Core Engine)                    │  ← Session, Route, Track, Plugin
├──────┬──────┬──────┬──────┬────────────────┤
│ evoral│ audio-│ back-│ sur- │ panners       │  ← 이벤트/오디오/백엔드
│      │grapher│ ends │faces │               │
├──────┴──────┴──────┴──────┴────────────────┤
│  pbd + temporal + midi++2                   │  ← 기반 유틸리티
└─────────────────────────────────────────────┘
```

### 3.2 libs/ 디렉토리 상세

#### 핵심 라이브러리

| 라이브러리 | 역할 |
|-----------|------|
| **ardour** | 핵심 DAW 엔진 (~330 헤더). Session, Route, Track, Region, Playlist, Plugin, Transport |
| **pbd** | 기반 유틸 ("Paul Barton-Davis"). Stateful(XML 직렬화), Signal(옵저버), Controllable, Undo, RCU |
| **temporal** | 시간/템포 시스템. BBT_Time, Beats, superclock_t, TempoMap, 시간 도메인 변환 |
| **evoral** | MIDI 이벤트, 자동화 커브(ControlList), Parameter, SMF(Standard MIDI File) |
| **midi++2** | MIDI I/O 추상화, MIDNAM(악기 이름 DB), MMC(Machine Control) |
| **backends** | 오디오 백엔드 추상화: JACK, ALSA, CoreAudio, PortAudio, PulseAudio, Dummy |
| **audiographer** | Export용 미니 오디오 그래프 (Source→Sink 체인, 디더링, 리샘플링) |
| **surfaces** | 컨트롤 서피스: Mackie, Push2, FaderPort, OSC, Generic MIDI 등 |
| **panners** | 패닝 알고리즘: stereobalance, VBAP, 1in2out, 2in2out |
| **plugins** | 내장 ACE 플러그인 (LV2): Compressor, EQ, Delay, Reverb, FluidSynth |

#### UI 라이브러리

| 라이브러리 | 역할 |
|-----------|------|
| **canvas** | Cairo 기반 벡터 드로잉 (타임라인, 리전, 오토메이션) |
| **widgets** | Ardour GUI 위젯 (버튼, 페이더, 노브 — CairoWidget 기반) |
| **gtkmm2ext** | GTK/GDK 유틸리티 확장, 이벤트 루프 |
| **waveview** | 쓰레디드 웨이브폼 렌더링 & 캐싱 |
| **tk** | 번들된 GTK2 (YTK/YDK/YTKMM) |

#### 서드파티 라이브러리

| 라이브러리 | 역할 |
|-----------|------|
| **aaf** | AAF 세션 임포트 |
| **fluidsynth** | 소프트웨어 신디사이저 (SoundFont) |
| **hidapi** | HID 디바이스 (Push2, Maschine) |
| **libltc** | Linear Timecode 인코딩/디코딩 |
| **lua** | Lua 5.3 + LuaBridge 바인딩 |
| **ptformat** | ProTools 세션 로딩 |
| **qm-dsp** | DSP (VAMP 플러그인용) |
| **vst3** | Steinberg VST3 SDK |
| **zita-convolver** | 컨볼루션 커널 |
| **zita-resampler** | 가변 속도 리샘플러 |

---

## 4. 도메인 모델 (libardour)

### 4.1 핵심 계층 구조

```
Session (최상위 오케스트레이터)
├── RouteList
│   ├── Route (믹서 스트립: I/O + 프로세서 체인)
│   │   ├── ProcessorList (시그널 체인)
│   │   │   ├── Amp (게인)
│   │   │   ├── PluginInsert[] (FX)
│   │   │   ├── Send (Aux 전송)
│   │   │   ├── PannerShell (패닝)
│   │   │   └── Delivery (출력)
│   │   ├── IO (입출력 포트)
│   │   ├── SoloControl, MuteControl, GainControl
│   │   └── AutomationControl (파라미터별)
│   │
│   └── Track : Route + 디스크 I/O
│       ├── DiskReader (Playlist로부터 재생)
│       ├── DiskWriter (녹음 → Source)
│       ├── Playlist
│       │   └── Region[]
│       │       ├── AudioRegion (오디오 리전)
│       │       └── MidiRegion (MIDI 리전)
│       │           └── Source[] (실제 파일 참조)
│       └── RecordEnableControl
│
├── SourceList (모든 오디오/MIDI 소스)
├── PlaylistSet (모든 플레이리스트)
├── LocationList (마커, 루프, 펀치)
├── TempoMap (Temporal::TempoMap)
├── AudioEngine (오디오 백엔드)
├── Butler (백그라운드 I/O 쓰레드)
├── Graph (리얼타임 처리 DAG)
├── VCAManager, CoreSelection
└── Lua state (스크립팅)
```

### 4.2 핵심 클래스 설명

#### Session (`libs/ardour/ardour/session.h`)

프로젝트 전체를 관장하는 최상위 객체:
- `HistoryOwner`, `StatefulDestructible`, `SessionEventManager`, `TransportAPI` 상속
- 트랙/버스 생성, 라우팅, 플레이리스트/리전 관리
- Transport 제어 (play/stop/locate)
- 녹음 관리, 세션 저장/로드 (XML)
- 리얼타임 `process()` 루프 위임
- Undo/Redo 히스토리
- 시그널: `DirtyChanged`, `TransportStateChanged`, `RouteAdded`, `RouteRemoved` 등

#### Route (`libs/ardour/ardour/route.h`)

믹서 스트립의 백엔드 표현:
- `Stripable`, `GraphNode`, `Soloable`, `Muteable`, `Monitorable` 상속
- ProcessorList: 시그널 체인 (Amp → Plugin → Send → Delivery)
- I/O: 입출력 포트 연결
- Solo/Mute/Gain/Pan 제어
- 오토메이션 (파라미터별 AutomationControl)

#### Track (`libs/ardour/ardour/track.h`)

Route + 디스크 기반 녹음/재생:
- DiskReader: Playlist에서 오디오 읽기
- DiskWriter: 입력을 Source에 기록
- Playlist: Region 컨테이너
- Freeze 상태 (오프라인 렌더링)
- AudioTrack / MidiTrack 특화

#### Region (`libs/ardour/ardour/region.h`)

Playlist 내 오디오/MIDI 클립:
- `SessionObject`, `Automatable`, `Readable` 상속
- 속성: start, length, layer, muted, locked, opaque
- Source 참조 (실제 파일)
- 리전 편집: 이동, 트림, 분할, 레이어링
- AudioRegion: 피치/타임스트레치, 크로스페이드
- MidiRegion: MIDI 이벤트 컨테이너

#### Source (`libs/ardour/ardour/source.h`)

실제 오디오/MIDI 데이터:
- AudioFileSource: 디스크 WAV 등
- SMFSource: Standard MIDI File
- 한번 녹음 후 읽기 전용
- `Readable::read_at(pos, nframes, chan)` 인터페이스

#### Processor (`libs/ardour/ardour/processor.h`)

시그널 체인의 모든 요소:
- `run()`, `set_block_size()` 가상 메서드
- 레이턴시 추적 (보상용)
- **PluginInsert**: 플러그인 호스팅 (VST/AU/LV2/LADSPA)
- **Amp**: 게인
- **Send**: Aux 전송
- **Return**: 사이드체인 수신
- **Delivery**: 출력 (패닝 포함)
- **MonitorProcessor**: 모니터링

---

## 5. 오디오 시그널 플로우

### 5.1 Route 프로세서 체인 (좌→우)

```
Input
  → DiskReader (Playlist에서 읽기)
  → Trim (입력 트림)
  → PluginInsert[] (FX 체인: Filter → Comp → EQ → Reverb)
  → Amp (페이더 게인)
  → PannerShell (L/R 패닝 또는 서라운드)
  → Send (Aux 버스로 전송)
  → Delivery (출력)
  → Master Bus (서브믹스)
  → System Output (스피커)

병렬:
  - DiskWriter (녹음 시 입력 → 디스크)
  - Metering (RMS/Peak 계산 → UI)
```

### 5.2 리얼타임 그래프 처리

```
Graph (DAG)
├── GraphNode (= Route)
│   ├── prep(GraphChain) — 버퍼/레이턴시/상태 초기화
│   └── run(GraphChain) — DSP 처리 (Route::process())
├── 토폴로지 정렬 (연결 기반 의존성 순서)
├── ProcessThread[] (코어당 1개, 병렬 실행)
└── 락프리 동기화 (activation_set, refcount)
```

Route 연결이 변경되면 그래프 재계산. 각 ProcessThread가 의존성 순서에 따라 노드를 병렬 실행.

---

## 6. Transport 시스템

### 6.1 상태 머신

```
Stopped → (Play) → Starting → Rolling → (Stop) → Stopping → Stopped
                                  ↑ Loop ↓
```

- `TransportAPI`: locate, start_transport, stop_transport, set_transport_speed
- `TransportFSM`: C++ 상태 머신 (Stopped/Rolling/Starting/Stopping)
- Sync 모드: Internal, JACK, MTC, MIDI Clock, LTC

### 6.2 시간 시스템 (Temporal)

| 타입 | 설명 |
|------|------|
| `samplepos_t` | 절대 샘플 위치 (int64_t) |
| `timepos_t` | 샘플 또는 비트 도메인 위치 |
| `timecnt_t` | 샘플 또는 비트 도메인 기간 |
| `superclock_t` | 고해상도 내부 클록 (1/19660800초) |
| `BBT_Time` | Bars.Beats.Ticks (음악적 위치) |
| `Beats` | 부동소수점 비트 카운트 |

**TempoMap**:
- Tempo 마커 (BPM), 박자표 변경
- sample ↔ BBT_Time ↔ Beats 변환
- 리전이 템포 변화를 따를지 결정 (AudioDomain vs BeatDomain)

---

## 7. 디스크 I/O & 녹음

### 7.1 재생

```
DiskReader
  → Playlist에서 현재 위치의 Region 조회
  → Region.Source.read_at() 호출
  → 리전 속성 적용 (게인, 피치)
  → 오버랩/크로스페이드 처리
  → Butler 쓰레드가 버퍼 리필
```

### 7.2 녹음

```
Record Enable → DiskWriter 활성화
  → Play 시작
  → 입력 오디오 → DiskWriter → Source 버퍼
  → Butler 쓰레드가 주기적으로 디스크에 플러시
  → Stop → Source 확정, Region 생성, Playlist에 추가
```

### 7.3 Butler 쓰레드

백그라운드 I/O 전담:
- `do_refill()`: DiskReader 버퍼 채우기
- `do_flush()`: DiskWriter 버퍼 → 디스크 쓰기
- RT 쓰레드와 `RTTaskList` (넌블로킹 큐)로 통신

---

## 8. 플러그인 아키텍처

### 8.1 지원 포맷

| 포맷 | 스캐너 | 비고 |
|------|--------|------|
| LV2 | 내장 | 주력 포맷 (내장 ACE 플러그인 포함) |
| VST2/3 | `fst` (별도 프로세스) | Steinberg SDK |
| AU (Audio Units) | `auscan` (별도 프로세스) | macOS 전용 |
| LADSPA | 내장 | 레거시 |

플러그인 스캔은 **별도 프로세스**에서 수행 (크래시 격리).

### 8.2 PluginInsert

```
PluginInsert : IOProcessor
├── Plugin[] (멀티채널 시 복수 인스턴스)
├── 프리셋/상태 관리
├── 핀 매핑 (유연한 I/O)
├── 레이턴시 보고
├── 파라미터별 AutomationControl
└── 사이드체인 입력 (IOProcessor)
```

---

## 9. 오토메이션

```
Automatable (Route, Region, Plugin 파라미터에 믹스인)
├── AutomationControl (파라미터당 1개)
│   ├── Parameter (Evoral::Parameter)
│   ├── ParameterDescriptor (범위, 토글, 단위)
│   ├── AutomationList (커브 데이터)
│   └── PBD::Controllable (CC 러닝 타겟)
└── 오토메이션 상태: Off / Play / Write / Touch
```

**AutomationList** (Evoral::ControlList):
- 보간: Linear, Discrete, Exponential, Cubic
- 시간 도메인: Musical(비트) / Audio(샘플)
- Undo/Redo 통합

---

## 10. 세션 영속성 (XML)

### 10.1 파일 구조

```
MySession/
├── MySession.ardour      # 메인 XML 파일
├── interchange/          # 오디오/MIDI 소스 파일
├── automation/           # 오토메이션 커브 (.gf)
├── plugins/              # 플러그인 상태
├── dead/                 # 삭제된 리전/소스 (Undo용)
└── analysis/             # 분석 데이터
```

### 10.2 XML 구조

```xml
<Session version="6" id="uuid">
  <Info name="MySession"/>
  <Tempo tempo="120.0" meter="4/4"/>
  <Sources>
    <Source id="uuid" name="audio-1.1" type="audio"/>
  </Sources>
  <Regions>
    <Region id="uuid" type="audio" start="0" length="44100" sources="..."/>
  </Regions>
  <Playlists>
    <Playlist id="uuid" name="Track1 (Playlist)" type="audio">
      <Region id="uuid" position="0"/>
    </Playlist>
  </Playlists>
  <Routes>
    <Route id="uuid" name="Track1" default-type="audio">
      <IO name="input" direction="input"/>
      <Processor type="amp"/>
      <Processor type="plugin" name="some-plugin.lv2"/>
      <Processor type="delivery"/>
    </Route>
  </Routes>
  <Locations>
    <Location id="uuid" name="MyMarker" start="22050"/>
  </Locations>
  <ConnectionList>
    <Connection source="system:capture_1" destination="Track1/input 1"/>
  </ConnectionList>
</Session>
```

### 10.3 Undo/Redo

- `PBD::Command` 객체로 직렬화
- `PBD::HistoryOwner` (Session이 소유)
- 중첩 UndoTransaction (원자적 그룹)

---

## 11. Export 시스템

```
ExportHandler (오케스트레이터)
├── ExportTimespan (범위: 선택영역, 전체 세션)
├── ExportChannelConfiguration (모노, 스테레오, 서라운드)
├── ExportFormatSpecification (WAV 24bit, MP3, FLAC, OPUS 등)
└── ExportGraphBuilder
    └── Audiographer 그래프
        ├── InterleaverNode (채널 인터리브)
        ├── ChannelMixerNode (채널 리믹스)
        ├── LimiterNode (클리핑 방지)
        ├── DithererNode (비트뎁스 감소)
        └── SndFileWriterNode (파일 쓰기)
```

---

## 12. UI 레이어 (gtk2_ardour)

### 12.1 주요 컴포넌트

```
ARDOUR_UI (메인 윈도우)
├── Editor (편집 뷰)
│   ├── TimeAxisView[] (트랙당)
│   │   ├── RegionView[] (리전 시각화)
│   │   └── AutomationLine[] (오토메이션 커브)
│   ├── Ruler (타임라인, 박자, 템포, 마커)
│   ├── EditorCursor (재생 커서)
│   └── Canvas (ArdourCanvas::GtkCanvas)
│
├── Mixer (믹서 뷰)
│   ├── MixerStrip[] (Route당 1개)
│   │   ├── 페이더, 패닝, 미터링
│   │   ├── 플러그인 UI 버튼
│   │   └── Solo/Mute/Rec 버튼
│   └── Master Strip
│
└── Dialogs (Preferences, KeyEditor, PortMatrix 등)
```

### 12.2 UI ↔ 백엔드 연결

1. **PBD::Signal** — 옵저버 패턴으로 느슨한 결합
2. **SessionHandlePtr** — `session->play()`, `route->set_gain()` 직접 호출
3. **CoreSelection** — UI와 libardour이 공유하는 선택 상태
4. **GtkAction/Bindings** — 메뉴/키바인딩 → C++ 슬롯

libardour은 gtk2_ardour에 의존하지 않음 (단방향 의존).

---

## 13. 쓰레딩 & 리얼타임

| 쓰레드 | 우선순위 | 역할 |
|--------|---------|------|
| **Process Thread** | 리얼타임 (최고) | 오디오 백엔드 콜백 → `Session::process()`. 메모리 할당/락/I/O 금지 |
| **Graph Threads** | 리얼타임 | 코어별 워커. 그래프 노드 병렬 실행 |
| **Butler** | 일반 | 백그라운드 디스크 I/O (리필/플러시) |
| **UI Thread** | 일반 | GTK 이벤트 루프. 시그널 수신 → UI 업데이트 |

### 락프리 동기화

- **RCU (Read-Copy-Update)**: Routes, Playlists — 리더 블로킹 없음, 라이터가 복사 후 원자적 스왑
- **Atomic\<T\>**: 스칼라 (RecordState, 플래그)
- **Ring Buffer**: RT → Butler 간 오디오/MIDI 큐
- RT 쓰레드에서 mutex/semaphore 사용 금지

---

## 14. 컨트롤 서피스

| 서피스 | 프로토콜 |
|--------|---------|
| Mackie Logic Control | MCU (MIDI), 모터라이즈드 페이더, LCD |
| Ableton Push 2 | 커스텀 USB |
| FaderPort | MIDI |
| OSC | UDP/TCP 네트워크 |
| Generic MIDI | 임의 MIDI 디바이스 매핑 |
| Novation Launchpad | MIDI 그리드 패드 |
| SSL Console 1 | DAW 믹서 컨트롤 |

`ControlProtocol` 추상 인터페이스 → 동적 로딩.

---

## 15. Drop-AI와의 대응 관계

| Ardour | Drop-AI | 비고 |
|--------|---------|------|
| `Session` | `SessionStore` | 프로젝트 전체 상태 |
| `Route` / `Track` | `TrackState` | 믹서 스트립 + 디스크 I/O |
| `Region` | `RegionState` | 타임라인 위 오디오 클립 |
| `Source` | Blob URL (`src`) | 실제 오디오 데이터 참조 |
| `Playlist` | `TrackState.regions[]` | 리전 컨테이너 |
| `Processor` 체인 | (미구현) | FX 체인 |
| `AudioEngine` + Backend | `IAudioEngine` (Tone.js) | 오디오 백엔드 추상화 |
| `AppController` (없음) | `AppController` (Facade) | Ardour는 Session이 직접 제어 |
| XML persistence | (미구현) | 세션 저장/로드 |
| `TempoMap` | `bpm` (단일 값) | 템포 시스템 |
| `DiskReader`/`DiskWriter` | (해당없음) | 브라우저 기반이라 디스크 I/O 불필요 |
| `Undo/Redo` | (미구현) | `PBD::Command` 기반 |
| `PluginInsert` | (미구현) | 플러그인 호스팅 |
| `Panner` | `setTrackPan()` | 패닝 (Ardour는 VBAP/서라운드까지) |
| `ControlProtocol` | AgentTerminal / CLI | 외부 제어 인터페이스 |
| `Graph` (RT DAG) | (해당없음) | 브라우저 Web Audio가 처리 |
| `Butler` 쓰레드 | (해당없음) | 디스크 버퍼링 불필요 |

---

*분석 기준일: 2026-04-09*
