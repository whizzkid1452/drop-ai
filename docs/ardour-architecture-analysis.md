# Ardour 프로젝트 아키텍처 분석

## 개요

Ardour는 오픈소스 DAW(Digital Audio Workstation) 소프트웨어로, 전문적인 오디오 편집 및 믹싱 기능을 제공합니다. 이 문서는 Ardour의 프로젝트 구조와 아키텍처를 분석합니다.

## 전체 아키텍처

Ardour는 **계층화된 아키텍처(Layered Architecture)**를 따르며, 크게 세 가지 레이어로 구성됩니다:

```
┌─────────────────────────────────────┐
│   Frontend Layer (UI)               │
│   - gtk2_ardour (GUI)               │
│   - headless (CLI)                  │
│   - luasession (Lua CLI)            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Core Engine Layer                 │
│   - libs/ardour (핵심 엔진)         │
│   - libs/backends (오디오 백엔드)   │
│   - libs/surfaces (컨트롤 서페이스) │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Foundation Layer                   │
│   - libs/pbd (기본 유틸리티)        │
│   - libs/evoral (이벤트 처리)       │
│   - libs/temporal (시간 처리)       │
│   - libs/midi++2 (MIDI 처리)         │
└─────────────────────────────────────┘
```

## 주요 컴포넌트

### 1. Frontend Layer (프론트엔드 레이어)

#### 1.1 gtk2_ardour
- **역할**: 메인 GUI 애플리케이션
- **기술**: GTK+2 기반
- **특징**: 
  - 백엔드와 완전히 분리된 구조
  - 대부분의 UI 복잡도가 여기에 집중
  - libardour를 라이브러리로 사용

#### 1.2 headless
- **역할**: GUI 없이 Ardour를 사용하는 데모 코드
- **용도**: 서버 환경, 자동화 스크립트, 테스트

#### 1.3 session_utils
- **역할**: libardour를 사용하는 명령줄 도구들
- **예시**: export 유틸리티

#### 1.4 luasession
- **역할**: libardour의 완전한 명령줄 인터페이스
- **기능**: Lua 스크립팅을 통한 세션 제어

### 2. Core Engine Layer (핵심 엔진 레이어)

#### 2.1 libs/ardour
- **역할**: Ardour의 핵심 오디오 처리 엔진
- **주요 클래스**:
  - `ARDOUR::Session`: 세션 관리
  - `ARDOUR::Route`: 오디오/MIDI 라우팅
  - `ARDOUR::Processor`: 플러그인 및 프로세서 체인
  - `ARDOUR::AudioEngine`: 실시간 오디오 처리
- **기능**:
  - 실시간 오디오 처리
  - 플러그인 관리
  - 세션 상태 관리
  - 오디오/MIDI 레코딩 및 재생

#### 2.2 libs/backends
- **역할**: 운영체제의 오디오/MIDI API와의 인터페이스
- **지원 백엔드**:
  - `alsa/`: Linux ALSA
  - `coreaudio/`: macOS CoreAudio
  - `jack/`: JACK Audio Connection Kit
  - `portaudio/`: PortAudio/ASIO (Windows)
  - `pulseaudio/`: PulseAudio (Linux)
  - `dummy/`: 테스트용 더미 백엔드
- **아키텍처**: `ARDOUR::AudioBackend` 인터페이스를 통한 추상화

#### 2.3 libs/surfaces
- **역할**: 런타임에 동적으로 로드되는 컨트롤 서페이스
- **기능**: MIDI 바인딩, 네트워크 제어 등
- **아키텍처**: `ARDOUR::ControlProtocol` 인터페이스

### 3. Foundation Layer (기반 레이어)

#### 3.1 libs/pbd
- **역할**: 모든 Ardour 라이브러리의 기반이 되는 유틸리티 클래스
- **기능**:
  - 기본 개념 및 OS 추상화
  - 스레드 관리
  - 메모리 관리
  - 설정 관리
- **이름 유래**: "Paul Barton-Davis" (프로젝트 창시자)

#### 3.2 libs/evoral
- **역할**: 이벤트 라이브러리
- **기능**:
  - 컨트롤 이벤트 처리
  - 컨트롤 리스트 관리
  - 자동화 평가
  - 파라미터 보간
  - MIDI 이벤트 추상화
- **서브모듈**: `libs/evoral/libsmf/` - Standard MIDI File 포맷 처리

#### 3.3 libs/temporal
- **역할**: 다양한 시간 표현 처리
- **기능**:
  - Timecode 처리
  - 음악적 시간 변환 (Beats, BBT_Time)
  - TempoMap 제공
- **중요성**: DAW에서 시간 표현은 매우 복잡하며, 이 라이브러리가 핵심 역할

#### 3.4 libs/midi++2
- **역할**: MIDI 파싱 및 처리
- **기능**:
  - MIDI 파싱
  - MIDNAM 처리
  - 포트 추상화 (I/O)

#### 3.5 libs/panners
- **역할**: 팬 플러그인 (런타임 동적 로드)
- **예시**: 스테레오 밸런스, VBAP 등
- **인터페이스**: `ARDOUR::Panner`

#### 3.6 libs/audiographer
- **역할**: 오디오 파일 내보내기용 미니 Ardour
- **구조**: `AudioGrapher::Source`와 `AudioGrapher::Sink` 클래스 체인
- **사용**: `ARDOUR::ExportGraphBuilder`에 의해 구성됨

### 4. UI Support Libraries (UI 지원 라이브러리)

#### 4.1 libs/gtkmm2ext
- **역할**: GDK, GTK 확장 유틸리티 라이브러리
- **기능**: UI 및 이벤트 루프 추상화
- **사용처**: GUI뿐만 아니라 Push2, NI Maschine 같은 컨트롤 서페이스에도 사용

#### 4.2 libs/canvas
- **역할**: Cairo 기반 스케일러블 드로잉 캔버스
- **기능**: 레이아웃 및 패킹
- **사용**: Ardour의 메인 에디터에서 사용
- **주요 클래스**: `ArdourCanvas::GtkCanvas`, `ArdourCanvas::Item`

#### 4.3 libs/widgets
- **역할**: Ardour GUI 위젯들
- **예시**: 버튼, 페이더, 노브 등
- **기반**: 모두 `CairoWidget` 기반

#### 4.4 libs/waveview
- **역할**: 스레드 기반 웨이브폼 렌더링
- **기능**: 웨이브폼 이미지 캐싱

#### 4.5 libs/tk
- **역할**: GTK+2의 로컬화된 버전 (YTK로 명명)
- **구성**:
  - `ydk`, `ytk`: gdk, gtk (upstream gtk+ 2.24.23 기반)
  - `ydk-pixbuf`: gdk-pixbuf 2.31.1 축소 버전
  - `ydkmm`, `ytkmm`: gdkmm, gtkmm (upstream gtkmm 2.45.3 기반)
  - `ztk`: atk 2.14.0
  - `ztkmm`: atkmm 2.22.7
  - `suil`: LV2 플러그인 UI 래퍼 (로컬 복사본)

### 5. Plugin System (플러그인 시스템)

#### 5.1 Plugin Scan Tools
플러그인은 기본적으로 전용 외부 프로세스에서 스캔됩니다. 이는 플러그인 크래시가 메인 애플리케이션에 영향을 주지 않도록 하기 위함입니다.

- **libs/auscan/**: Apple Audio Unit 플러그인 스캔 도구
- **libs/fst/**: VST2/3 플러그인 스캔 도구
- **libs/vfork/**: vfork(2)를 사용한 exec-wrapper

#### 5.2 Plugin Support
- **LV2**: 네이티브 지원
- **VST2**: Linux (LXVST), macOS (MacVST), Windows 지원
- **VST3**: 모든 플랫폼 지원
- **AudioUnit**: macOS 전용
- **LADSPA**: 레거시 지원

#### 5.3 libs/plugins
- **역할**: Ardour Community Effect (ACE) 플러그인
- **내용**: 기본적인 LV2 플러그인 세트
- **특징**: 모든 플랫폼에 번들로 포함

### 6. Third-Party Libraries (서드파티 라이브러리)

프로젝트 내에 포함된 독립적인 서드파티 라이브러리들:

- **libs/aaf/**: AAF 세션 임포트 (LibAAF)
- **libs/appleutility/**: CoreAudio 및 AudioUnits 유틸리티 (macOS)
- **libs/ardouralsautil/**: ALSA 디바이스 리스팅 및 예약
- **libs/clearlooks-newer/**: GTK 테마 엔진
- **libs/fluidsynth/**: FluidSynth 축소 버전 (라이브러리만)
- **libs/hidapi/**: HID 디바이스 상호작용 (Push2, NI Maschine)
- **libs/libltc/**: Linear Timecode 인코딩/디코딩
- **libs/lua/**: Lua 스크립트 인터프리터 및 C++ 바인딩
- **libs/ptformat/**: ProTools 세션 로딩
- **libs/qm-dsp/**: Queen Mary DSP 라이브러리 (VAMP 플러그인용)
- **libs/vamp-plugins/**: 오디오 분석용 VAMP 플러그인
- **libs/vamp-pyin/**: 피치 및 노트 트래킹용 VAMP 플러그인
- **libs/vst3/**: Steinberg VST3 SDK 축소 버전
- **libs/zita-convolver/**: 컨볼루션 커널 (Lua 스크립트용)
- **libs/zita-resampler/**: 효율적인 리샘플러 (vari-speed 재생용)

## 빌드 시스템

### Waf Build System
- **빌드 도구**: Waf (Python 기반)
- **설정 파일**: `wscript`
- **특징**:
  - 크로스 플랫폼 지원 (Linux, macOS, Windows)
  - 다양한 컴파일러 지원 (GCC, Clang, MSVC)
  - 플랫폼별 최적화 (SSE, AVX, NEON)
  - 모듈화된 빌드 구조

### 빌드 구성
```python
children = [
    # 패치된 서드파티 라이브러리
    'libs/clearlooks-newer',
    'libs/zita-resampler',
    'libs/zita-convolver',
    
    # 코어 Ardour 라이브러리
    'libs/pbd',
    'libs/evoral',
    'libs/temporal',
    'libs/ardour',
    
    # 프론트엔드
    'gtk2_ardour',
    'headless',
    'session_utils',
]
```

## 데이터 흐름

### 오디오 처리 파이프라인
```
Audio Input
    ↓
AudioBackend (JACK/ALSA/CoreAudio 등)
    ↓
AudioEngine
    ↓
Route (Track/Bus)
    ↓
Processor Chain (Plugins, EQ, etc.)
    ↓
Mix
    ↓
AudioBackend Output
```

### 세션 관리
```
Session
    ├── Routes (Tracks, Busses)
    │   ├── Processors
    │   ├── Regions
    │   └── Playlists
    ├── TempoMap
    ├── Locations (Markers)
    └── Automation
```

## 주요 설계 원칙

### 1. 관심사 분리 (Separation of Concerns)
- **GUI와 엔진 분리**: `gtk2_ardour`는 UI만 담당, `libs/ardour`는 로직만 담당
- **백엔드 추상화**: `AudioBackend` 인터페이스를 통한 플랫폼 독립성

### 2. 모듈화
- 각 라이브러리는 독립적으로 빌드 가능
- 공유 라이브러리 또는 정적 라이브러리로 구성 가능

### 3. 실시간 처리 최적화
- 실시간 스레드와 비실시간 스레드 분리
- 메모리 할당 최소화
- 플러그인 스캔을 별도 프로세스로 분리

### 4. 확장성
- 동적 플러그인 로딩
- 컨트롤 서페이스 플러그인 시스템
- Lua 스크립팅 지원

## 리소스 파일

### share/ 디렉토리
- **export/**: 내보내기 포맷 및 프리셋
- **mcp/**: Mackie 컨트롤 서페이스 디바이스 파일
- **midi_maps/**: 일반 MIDI 컨트롤 서페이스 프리셋
- **osc/**: TouchOSC 레이아웃
- **patchfiles/**: MIDNAM 파일 (MIDI 신시사이저 설명)
- **scripts/**: Lua 스크립트
- **templates/**: 세션 템플릿

## 플랫폼 지원

### Linux
- ALSA, JACK, PulseAudio 백엔드
- LXVST 지원

### macOS
- CoreAudio 백엔드
- AudioUnit 지원
- MacVST 지원

### Windows
- PortAudio/ASIO 백엔드
- Windows VST 지원

## 성능 최적화

### CPU 최적화
- **SSE/AVX**: x86/x64 플랫폼에서 SIMD 명령어 사용
- **NEON**: ARM 플랫폼에서 SIMD 명령어 사용
- **컴파일러 최적화**: 플랫폼별 최적화 플래그

### 메모리 관리
- 실시간 스레드에서의 메모리 할당 최소화
- 버퍼 풀링
- 순환 버퍼 사용

## 결론

Ardour는 다음과 같은 특징을 가진 잘 설계된 아키텍처를 가지고 있습니다:

1. **명확한 계층 분리**: Frontend, Core Engine, Foundation 레이어로 명확히 구분
2. **모듈화**: 각 컴포넌트가 독립적으로 개발 및 테스트 가능
3. **확장성**: 플러그인 시스템, 컨트롤 서페이스, 스크립팅 지원
4. **플랫폼 독립성**: 추상화된 백엔드를 통한 크로스 플랫폼 지원
5. **실시간 처리**: 실시간 오디오 처리에 최적화된 설계

이러한 아키텍처는 drop.ai 프로젝트에서 참고할 수 있는 좋은 사례입니다.
