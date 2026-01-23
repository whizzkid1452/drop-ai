프로젝트 구조 분석 및 개선 계획
본 문서는 현재 React/TypeScript 웹 애플리케이션 구조와 레퍼런스인 Ardour(C++) DAW 구조를 비교하고, 아키텍처 개선을 위한 권장 사항을 제공합니다.

1. 개요 비교
기능	현재 프로젝트 (Drop AI)	레퍼런스 프로젝트 (Ardour)
아키텍처	컴포넌트 기반 (React) + 서비스 기반 (AudioEngine)	계층형 아키텍처 (Libs + UI)
상태 관리	React Stores (Zustand 스타일) + AudioEngine 동기화	도메인 오브젝트 모델 (C++ 클래스)
모듈화	logics/audio, components, stores	libs/ardour, libs/evoral, libs/temporal 등
핵심 로직	
audioEngine.ts
 및 Store에 혼재	libs/ardour (Session, Track, Route)에 캡슐화
2. 주요 발견 사항 및 약점
A. 도메인과 인프라의 혼재
현재: 
AudioEngine
이 상위 수준의 트랙 관리(트랙 추가 등)와 하위 수준의 오디오 처리(Tone.js 호출)를 모두 처리합니다.
레퍼런스: libs/ardour(도메인: 트랙, 세션)를 libs/backends(인프라: 오디오 드라이버)와 분리합니다.
B. "빈약한(Anemic)" 도메인 모델
현재: 데이터 정의(TrackData, 
Region
)가 Store에 저장된 인터페이스/타입에 불과해 보입니다. 로직은 서비스나 훅에 흩어져 있습니다.
레퍼런스: Ardour의 
Track
은 해당 동작을 정의하는 메서드를 가진 클래스일 가능성이 높습니다.
리스크: 복잡성이 증가함에 따라, 로직이 데이터와 함께 캡슐화되지 않으면 불변성(예: "리전은 겹칠 수 없음")을 보장하기 어려워집니다.
C. 제한된 세밀함(Granularity)
현재: logics/audio가 모든 것을 처리하는 범용 폴더 역할을 합니다.
레퍼런스: 타이밍(temporal), 이벤트(evoral), 유틸리티(pbd)를 위한 별도의 라이브러리가 존재합니다.
3. 권장 구조 ("Drop AI"의 진화)
Ardour의 구조를 TypeScript/Web에 맞춰 변형한 클린 아키텍처(Clean Architecture) 또는 핵심 아키텍처(Hexagonal Architecture) 접근 방식을 채택합니다.

src/
├── core/                  # (신규) 도메인 계층 - libs/ardour에 해당
│   ├── session/           # 세션 관리
│   ├── track/             # 트랙 개념 (UI 아님)
│   ├── region/            # 리전 로직
│   ├── time/              # 시간 변환 (Beats, Seconds) - libs/temporal에 대응
│   └── events/            # 자동화/이벤트 - libs/evoral에 대응
│
├── infrastructure/        # (신규) 인터페이스 어댑터
│   ├── audio/             # Tone.js 래퍼 (AudioBackend) - libs/backends에 대응
│   ├── storage/           # LocalStorage/서버 동기화
│   └── workers/           # 고부하 작업을 위한 Web Workers
│
├── presentation/          # (components/Daw에서 변경)
│   ├── stores/            # Core와 UI를 연결하는 뷰 모델 / Store
│   ├── components/        # React 컴포넌트
│   └── hooks/             # Core 유스케이스를 호출하는 어댑터
│
└── main.tsx
4. 세부 개선 제안
1. 순수 도메인 모델 추출
가능한 한 React나 Tone.js 의존성 없이 순수 TypeScript로 비즈니스 로직을 표현하는 클래스나 모듈을 core/에 생성합니다.

이전: 
Track
은 types/의 인터페이스이고, 로직은 
AudioEngine
에 있습니다.
이후: core/track/의 class Track { ... }. 자체 리전 관리, 볼륨 상태 로직(dB 변환 곡선) 등을 직접 관리합니다.
2. 분리된 오디오 백엔드 (HAL - Hardware Abstraction Layer)
AudioEngine
을 도메인 모델과 Tone.js 사이의 "브리지(Bridge)" 역할을 하도록 리팩토링합니다.

core/audio/AudioGraph: 논리적 연결을 정의합니다.
infrastructure/audio/ToneBackend: Tone.js를 사용하여 그래프를 구현합니다.
이를 통해 나중에 Tone.js를 교체하거나 실제 오디오 컨텍스트 없이 테스트를 실행할 수 있습니다.
3. 특화된 시간/수학 라이브러리
시간 계산(seconds <-> bars/beats)을 core/time(또는 libs/temporal 대응)으로 옮깁니다. 이는 DAW에서 매우 중요하며 특정 오디오 엔진으로부터 격리되어야 합니다.

5. 실행 계획
디렉토리 구조 생성: core 및 infrastructure 폴더를 설정합니다.
AudioEngine 리팩토링:
AudioEngine
을 AudioBackend(Tone.js 전용)와 SessionManager(로직 전용)로 분리합니다.
로직 마이그레이션:
순수 로직(예: "클립 길이 계산", "그리드 스냅")을 컴포넌트/훅에서 core/로 이동합니다.