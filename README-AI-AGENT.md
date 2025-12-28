# 🤖 Drop.AI - AI 에이전트 MVP 구현 완료

## 🎉 구현 완료 사항

WebLLM을 사용하여 브라우저에서 직접 Llama 모델을 실행하고, 자연어로 DAW를 제어할 수 있는 AI 에이전트를 성공적으로 구현했습니다!

## ✨ 주요 기능

### 1. 브라우저 내 AI 실행
- **WebLLM** 기반 Hermes-3-Llama-3.1-8B 모델
- 서버 없이 완전한 클라이언트 사이드 실행
- WebGPU 가속으로 빠른 추론 속도

### 2. 자연어 DAW 제어
AI와 대화하며 다음 작업을 수행할 수 있습니다:
- ✅ 트랙 볼륨 조절
- ✅ 음소거/솔로 설정
- ✅ 재생 속도 변경
- ✅ 트랙 삭제
- ✅ 프로젝트 정보 조회

### 3. Function Calling 시스템
- 안전한 도구 기반 제어
- 파라미터 자동 검증
- 실행 이력 시각화

## 🚀 빠른 시작

### 1. 개발 서버 실행

```bash
pnpm install
pnpm dev
```

### 2. 브라우저 접속
- Chrome 113 이상 필요 (WebGPU 지원)
- http://localhost:5173 접속

### 3. 오디오 파일 업로드
- 드래그 앤 드롭으로 오디오 파일 추가
- 트랙이 생성되면 AI 채팅 패널이 우측에 표시됩니다

### 4. AI 모델 로드
- "AI 모델 로드하기" 버튼 클릭
- 최초 실행 시 약 4.7GB 다운로드 (5-10분 소요)
- 이후 브라우저 캐시에서 즉시 로드

### 5. AI와 대화 시작!

```
💬 "첫 번째 트랙 볼륨을 70%로 설정해줘"
🤖 [볼륨 조절 실행] "트랙 볼륨을 70%로 설정했습니다."

💬 "소리가 너무 커, 좀 줄여줘"
🤖 [볼륨 조절 실행] "볼륨을 낮췄습니다."

💬 "이 트랙만 듣고 싶어"
🤖 [솔로 설정 실행] "솔로로 설정했습니다."
```

## 📁 프로젝트 구조

```
src/
├── components/
│   ├── AIChat/              # AI 채팅 UI
│   │   ├── AIChat.tsx
│   │   └── AIChat.css.ts
│   └── Daw/
│       └── DawPage.tsx      # AI 채팅 통합
├── stores/
│   └── useAIAgentStore.ts   # AI 에이전트 상태 관리
├── types/
│   └── aiAgent.ts           # AI 관련 타입 정의
├── constants/
│   └── aiTools.ts           # Function Calling 도구 정의
└── utils/
    └── webgpu.ts            # WebGPU 지원 확인
```

## 🛠️ 기술 스택

- **AI 엔진**: @mlc-ai/web-llm (Hermes-3-Llama-3.1-8B)
- **상태 관리**: Zustand
- **UI**: React + Vanilla Extract
- **빌드**: Vite
- **가속**: WebGPU

## 📋 시스템 요구사항

### 필수
- Chrome 113+ (WebGPU 지원)
- 최소 6GB VRAM GPU
- 8GB+ RAM
- 5GB 저장공간 (최초 모델 다운로드)

### 권장
- Chrome 최신 버전
- 8GB+ VRAM GPU (NVIDIA/AMD)
- 16GB+ RAM
- SSD 저장장치

## 🔧 설정

### Vite 보안 헤더 (이미 설정됨)

```typescript
// vite.config.ts
server: {
  headers: {
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
  },
}
```

이 설정은 WebGPU와 SharedArrayBuffer 사용을 위해 필수입니다.

## 🎯 사용 예시

### 볼륨 조절
```
"첫 번째 트랙 볼륨을 50%로 낮춰줘"
"소리를 키워줘"
"볼륨을 0.8로 설정해줘"
```

### 음소거/솔로
```
"두 번째 트랙 음소거해줘"
"이 트랙만 들려줘"
"솔로 해제해줘"
```

### 재생 속도
```
"느리게 재생해줘"
"2배속으로 들려줘"
"정상 속도로 돌려줘"
```

### 정보 조회
```
"현재 트랙이 몇 개야?"
"프로젝트 상태 알려줘"
"첫 번째 트랙 정보 보여줘"
```

## 🐛 문제 해결

### "WebGPU를 사용할 수 없습니다"
1. Chrome 버전 확인 (113 이상)
2. `chrome://flags` → "WebGPU" 검색 → 활성화
3. 그래픽 드라이버 최신 버전으로 업데이트

### "SharedArrayBuffer is not defined"
1. Vite 설정의 보안 헤더 확인
2. HTTPS 환경에서 실행 (localhost는 예외)
3. 개발 서버 재시작

### 모델 로딩이 실패합니다
1. 인터넷 연결 확인
2. 브라우저 캐시 삭제 후 재시도
3. 콘솔 로그에서 상세 오류 확인

### AI가 명령을 이해하지 못합니다
1. 더 구체적으로 명령 (트랙 번호/ID 명시)
2. 한 번에 하나의 작업만 요청
3. 프로젝트 상태 먼저 확인 ("트랙 정보 알려줘")

## 📚 상세 문서

더 자세한 내용은 다음 문서를 참고하세요:
- [AI 에이전트 구현 가이드](./docs/ai-agent-implementation.md)
- [개발 로드맵](./docs/develop-road-map.md)
- [MVP 로드맵](./docs/road-map-mvp.md)

## 🔮 향후 계획

### Phase 2: 고급 오디오 처리
- 이펙트 추가 (Reverb, Delay, EQ)
- 오디오 자르기 및 편집
- 페이드 인/아웃

### Phase 3: 생성형 기능
- 텍스트-투-오디오 생성
- 자동 믹싱 제안
- 스타일 기반 이펙트 추천

### Phase 4: 협업 기능
- 멀티유저 세션
- 실시간 동기화
- 버전 관리

## 🤝 기여

이슈나 PR은 언제나 환영합니다!

## 📄 라이선스

MIT License

---

**Made with ❤️ using WebLLM and React**

