# WebLLM 설정 가이드

## 🚀 WebLLM으로 전환 완료!

이제 OpenAI API 대신 **로컬 크롬 브라우저에서 Llama 모델을 실행**합니다.

## ✅ 장점

- **프라이버시 보호**: 모든 처리가 로컬에서 이루어집니다
- **API 비용 없음**: OpenAI API 키가 필요 없습니다
- **오프라인 작동**: 인터넷 연결 없이도 작동 가능 (모델 다운로드 후)
- **무제한 사용**: API 호출 제한이 없습니다

## 📋 사전 요구사항

### 1. 브라우저 요구사항

- **Chrome 113 이상** (또는 Edge 113 이상)
- WebGPU 지원 활성화

### 2. WebGPU 활성화 확인

1. Chrome 주소창에 `chrome://flags` 입력
2. "WebGPU" 검색
3. "WebGPU Developer Features" 활성화
4. 브라우저 재시작

### 3. 하드웨어 요구사항

- **최소**: 6GB VRAM (Llama 3 8B 양자화 버전)
- **권장**: 8GB+ VRAM
- VRAM이 부족하면 자동으로 더 작은 모델(TinyLlama)로 전환됩니다

## 🎯 사용 방법

### 1. 개발 서버 실행

```bash
# Express 서버는 더 이상 필요 없습니다!
pnpm dev
```

### 2. 브라우저에서 확인

1. `http://localhost:5173/daw` 접속
2. 오른쪽 AI 채팅 패널 확인
3. **첫 실행 시**: 모델 다운로드가 시작됩니다 (수 GB, 시간 소요)
4. 다운로드 완료 후 자동으로 초기화됩니다

### 3. 모델 로딩 상태

- 초기화 중: 진행 상황이 표시됩니다
- 완료: "안녕하세요! 오디오 편집을 도와드리겠습니다" 메시지 표시

## 🔧 모델 선택

현재 설정된 모델 우선순위:

1. **Llama-3-8B-Instruct-q4f16_1-MLC** (기본)
   - 품질: 높음
   - VRAM: ~6GB 필요
   - 속도: 중간

2. **TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC** (폴백)
   - 품질: 낮음
   - VRAM: ~2GB 필요
   - 속도: 빠름

VRAM이 부족하면 자동으로 작은 모델로 전환됩니다.

## 🐛 문제 해결

### "WebGPU가 지원되지 않습니다"

**해결책:**
1. Chrome 버전 확인 (113 이상 필요)
2. `chrome://flags`에서 WebGPU 활성화
3. 브라우저 재시작

### "GPU 어댑터를 찾을 수 없습니다"

**해결책:**
- GPU 드라이버 업데이트
- 하드웨어 가속 활성화 확인

### 모델 로딩이 너무 느림

**해결책:**
- 첫 다운로드는 한 번만 발생 (브라우저 캐시에 저장)
- 이후 실행은 즉시 시작됩니다
- 더 작은 모델 사용 고려

### 메모리 부족 오류

**해결책:**
- 다른 탭 닫기
- 더 작은 모델로 전환 (자동 처리됨)
- VRAM이 6GB 미만이면 TinyLlama 사용

## 📊 성능 비교

| 항목 | OpenAI API | WebLLM (Llama 3 8B) |
|------|-----------|---------------------|
| 응답 속도 | 빠름 (~2초) | 느림 (~5-10초) |
| 품질 | 매우 높음 | 높음 |
| 비용 | 토큰당 과금 | 무료 |
| 프라이버시 | 서버 전송 | 로컬 처리 |
| 오프라인 | 불가 | 가능 |

## 🔄 OpenAI API로 되돌리기

만약 OpenAI API를 다시 사용하고 싶다면:

1. `src/components/Daw/components/AiChat/AiChatPanel.tsx`에서
2. `webllm-client` 대신 `ai-api-client` import
3. Express 서버 실행 (`pnpm dev:server`)

## 📝 참고 자료

- [WebLLM 공식 문서](https://webllm.mlc.ai/)
- [MLC LLM 프로젝트](https://mlc.ai/)
- [WebGPU 스펙](https://www.w3.org/TR/webgpu/)

