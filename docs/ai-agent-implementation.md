# AI 에이전트 구현 가이드

## 개요

Drop.AI의 MVP 버전에서는 WebLLM을 사용하여 브라우저 내에서 Llama 모델을 실행하고, 자연어로 DAW를 제어할 수 있는 AI 에이전트를 구현했습니다.

## 아키텍처

### 핵심 구성 요소

1. **WebLLM 엔진** (`@mlc-ai/web-llm`)
   - 브라우저에서 Llama-3.1-8B-Instruct 모델 실행
   - WebGPU를 활용한 고성능 추론
   - 약 4.7GB 모델 크기 (최초 다운로드 후 캐싱)

2. **AI 에이전트 스토어** (`useAIAgentStore`)
   - Zustand 기반 상태 관리
   - 채팅 메시지 히스토리
   - 모델 로딩 상태 관리

3. **Function Calling 도구**
   - AI가 DAW를 제어하기 위한 사전 정의된 함수들
   - 안전한 파라미터 검증
   - 트랙 제어 기능 (볼륨, 음소거, 솔로 등)

4. **AI 채팅 UI** (`AIChat`)
   - 실시간 대화 인터페이스
   - 도구 호출 시각화
   - 로딩 상태 및 에러 처리

## 시스템 요구사항

### 브라우저
- **Chrome 113 이상** (WebGPU 지원)
- Safari, Firefox는 현재 미지원

### 하드웨어
- **GPU**: 최소 6GB VRAM 권장
- **RAM**: 8GB 이상 권장
- **저장공간**: 최초 모델 다운로드 시 약 5GB 필요

### 보안 설정
Vite 개발 서버에 다음 헤더가 설정되어 있어야 합니다:

```typescript
{
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
}
```

이는 WebGPU와 SharedArrayBuffer 사용을 위해 필수적입니다.

## 사용 가능한 AI 도구

### 1. set_track_volume
트랙의 볼륨을 조절합니다.

**파라미터:**
- `trackId` (string): 트랙 ID
- `volume` (number): 0.0 ~ 1.0 사이의 값

**예시:**
- "첫 번째 트랙 볼륨을 50%로 낮춰줘"
- "모든 트랙 소리를 키워줘"

### 2. toggle_track_mute
트랙을 음소거하거나 해제합니다.

**파라미터:**
- `trackId` (string): 트랙 ID

**예시:**
- "두 번째 트랙 음소거해줘"
- "음소거 해제해줘"

### 3. toggle_track_solo
트랙을 솔로로 설정합니다.

**파라미터:**
- `trackId` (string): 트랙 ID

**예시:**
- "이 트랙만 들려줘"
- "솔로 설정해줘"

### 4. set_playback_rate
재생 속도를 조절합니다.

**파라미터:**
- `trackId` (string): 트랙 ID
- `rate` (number): 0.25 ~ 4.0 사이의 값

**예시:**
- "느리게 재생해줘"
- "2배속으로 들려줘"

### 5. delete_track
트랙을 삭제합니다.

**파라미터:**
- `trackId` (string): 트랙 ID

**예시:**
- "이 트랙 삭제해줘"

### 6. get_project_info
현재 프로젝트 정보를 조회합니다.

**예시:**
- "현재 트랙이 몇 개야?"
- "프로젝트 상태 알려줘"

## 사용 방법

### 1. 모델 초기화

트랙을 추가한 후 AI 채팅 패널에서 "AI 모델 로드하기" 버튼을 클릭합니다.

최초 실행 시:
- 약 4.7GB의 모델 다운로드 (5-10분 소요)
- IndexedDB에 캐싱되어 이후 빠른 로딩

### 2. 대화 시작

모델 로드 완료 후 자연어로 명령을 입력합니다:

```
사용자: "첫 번째 트랙 볼륨을 70%로 설정해줘"
AI: [set_track_volume 실행] "트랙 볼륨을 70%로 설정했습니다."

사용자: "소리가 너무 커, 좀 줄여줘"
AI: [set_track_volume 실행] "볼륨을 낮췄습니다."

사용자: "이 트랙만 듣고 싶어"
AI: [toggle_track_solo 실행] "솔로로 설정했습니다."
```

## 기술적 세부사항

### ReAct 패턴

AI 에이전트는 ReAct (Reason + Act) 패턴을 사용합니다:

1. **Thought**: 사용자 요청 분석
2. **Action**: 적절한 도구 선택 및 실행
3. **Observation**: 결과 확인
4. **Repeat**: 필요시 반복

### 컨텍스트 주입

매 요청마다 현재 프로젝트 상태를 AI에게 전달:

```typescript
현재 프로젝트 상태:
총 트랙 수: 2

트랙 1 (ID: track-123):
  - 오디오 파일: vocals.mp3
  - 볼륨: 80%
  - 음소거: 아니오
  - 솔로: 아니오

트랙 2 (ID: track-456):
  - 오디오 파일: drums.wav
  - 볼륨: 60%
  - 음소거: 예
  - 솔로: 아니오
```

### 안전성 보장

1. **파라미터 검증**: 모든 값은 안전한 범위로 제한
2. **비파괴적 편집**: 원본 데이터는 보존
3. **Undo/Redo**: 모든 작업은 되돌릴 수 있음
4. **샌드박싱**: AI는 사전 정의된 도구만 실행 가능

## 성능 최적화

### 메모리 관리
- 모델은 싱글톤으로 관리
- 사용하지 않을 때 메모리 해제
- 대화 히스토리 제한 (최근 20개 메시지)

### 추론 속도
- GPU 가속 활용
- 배치 처리로 지연 시간 최소화
- 스트리밍 응답 (향후 구현 예정)

## 문제 해결

### WebGPU를 사용할 수 없습니다
- Chrome 113 이상 사용 확인
- `chrome://flags`에서 WebGPU 활성화
- 그래픽 드라이버 업데이트

### SharedArrayBuffer is not defined
- Vite 설정의 보안 헤더 확인
- HTTPS 환경에서 실행 (localhost는 예외)

### 모델 로딩이 너무 느립니다
- 인터넷 연결 확인
- 브라우저 캐시 확인 (IndexedDB)
- 더 작은 모델 사용 고려 (Llama-3.1-3B)

### AI가 잘못된 작업을 수행합니다
- 더 구체적인 명령 사용
- 트랙 ID나 이름 명시
- 프롬프트 엔지니어링 개선 필요

## 향후 개발 계획

### Phase 2: 고급 오디오 처리
- [ ] 이펙트 추가 (Reverb, Delay, EQ)
- [ ] 오디오 자르기 및 편집
- [ ] 페이드 인/아웃

### Phase 3: 생성형 기능
- [ ] 텍스트-투-오디오 생성
- [ ] 자동 믹싱 제안
- [ ] 스타일 기반 이펙트 추천

### Phase 4: 협업 기능
- [ ] 멀티유저 세션
- [ ] 실시간 동기화
- [ ] 버전 관리

## 참고 자료

- [WebLLM 공식 문서](https://github.com/mlc-ai/web-llm)
- [WebGPU 사양](https://www.w3.org/TR/webgpu/)
- [ReAct 패턴](https://www.ibm.com/think/topics/react-agent)
- [Function Calling 가이드](https://platform.openai.com/docs/guides/function-calling)

## 라이선스

MIT License - 자세한 내용은 프로젝트 루트의 LICENSE 파일 참조


