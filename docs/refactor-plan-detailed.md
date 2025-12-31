# Drop.AI 리팩토링 플랜 (상세 분석 및 실행 계획)

## 📋 프로젝트 현황 진단

### ✅ 잘 구현된 부분

1. **COOP/COEP 헤더 설정** (완료)
   - `vite.config.ts`에 올바르게 설정됨
   - 개발/프리뷰 서버 모두 적용

2. **Web Worker 기본 구조** (완료)
   - `useWebLLM.ts`에서 Worker 사용
   - `CreateWebWorkerMLCEngine` 활용

3. **AudioEngine 싱글톤 패턴** (완료)
   - Tone.js 객체를 Map으로 관리
   - React useState에 저장하지 않음

4. **상태 관리 분리** (완료)
   - Zustand로 UI 상태 관리
   - AudioEngine으로 오디오 상태 관리

---

## ⚠️ 개선이 필요한 부분 (우선순위별)

### 🔴 Priority 1: 치명적 버그 및 메모리 누수

#### 1.1 Tone.js 리소스 Dispose 패턴 미구현 ❌
**문제:**
- `useTrackStore.removeTrack()`에서 Tone.js 노드의 `.dispose()` 호출이 없음
- 트랙 삭제 시 메모리 누수 + 백그라운드 CPU 점유

**위치:**
- `src/stores/useTrackStore.ts` (67-74번 줄)
- `src/logics/audio/audioEngine.ts` (리소스 해제 메서드 부재)

**해결 방법:**
```typescript
// AudioEngine에 추가
public disposeTrack(trackId: string) {
  const track = this.tracks.get(trackId);
  if (!track) return;
  
  // 모든 Player dispose
  track.players.forEach(player => player.dispose());
  
  // Channel dispose
  track.channel.dispose();
  
  // Map에서 제거
  this.tracks.delete(trackId);
}
```

```typescript
// useTrackStore.removeTrack() 수정
removeTrack: ({ trackId }) => {
  // 먼저 AudioEngine에서 리소스 해제
  AudioEngine.getInstance().disposeTrack(trackId);
  
  set(state => {
    const newTracks = new Map(state.tracks);
    newTracks.delete(trackId);
    return { tracks: newTracks };
  });
}
```

---

#### 1.2 Tone.Transport와 UI의 실시간 동기화 미구현 ⚠️
**문제:**
- `usePlaybackStore.currentTime`이 UI 상태일 뿐, Tone.Transport와 동기화되지 않음
- 재생 중 진행 바(Playhead)가 업데이트되지 않을 가능성

**위치:**
- `src/stores/usePlaybackStore.ts` (currentTime 업데이트 로직 부재)
- Tone.Draw.schedule 사용 부재

**해결 방법:**
```typescript
// src/hooks/useToneTransportSync.ts (신규)
import { useEffect } from 'react';
import * as Tone from 'tone';
import { usePlaybackStore } from '@/stores/usePlaybackStore';

export function useToneTransportSync() {
  const setCurrentTime = usePlaybackStore(state => state.setCurrentTime);
  const isPlaying = usePlaybackStore(state => state.isPlaying);
  
  useEffect(() => {
    if (!isPlaying) return;
    
    let rafId: number;
    
    const updateTime = () => {
      // Tone.Draw.schedule을 통해 requestAnimationFrame과 동기화
      Tone.Draw.schedule(() => {
        const seconds = Tone.getTransport().seconds;
        setCurrentTime(seconds);
      }, Tone.now());
      
      rafId = requestAnimationFrame(updateTime);
    };
    
    rafId = requestAnimationFrame(updateTime);
    
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, setCurrentTime]);
}
```

---

### 🟡 Priority 2: AI 에이전트 안정성 및 정확도

#### 2.1 Zod 기반 런타임 스키마 검증 미구현 ❌
**문제:**
- AI 응답을 regex로만 파싱 (`aiResponseHandler.ts` 93번 줄)
- 잘못된 JSON 출력 시 런타임 에러 가능성
- Self-Correction 루프 없음

**위치:**
- `src/hooks/agent/aiResponseHandler.ts`
- `src/hooks/agent/commandParser.ts`

**해결 방법:**
```typescript
// src/types/audioCommand.schema.ts (신규)
import { z } from 'zod';

export const AudioCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('PLAY'),
  }),
  z.object({
    type: z.literal('PAUSE'),
  }),
  z.object({
    type: z.literal('STOP'),
  }),
  z.object({
    type: z.literal('SET_TRACK_VOLUME'),
    trackId: z.string().uuid(),
    volume: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal('SET_TRACK_PAN'),
    trackId: z.string().uuid(),
    pan: z.number().min(-1).max(1),
  }),
]);

export type AudioCommandFromAI = z.infer<typeof AudioCommandSchema>;
```

```typescript
// aiResponseHandler.ts 수정
import { AudioCommandSchema } from '@/types/audioCommand.schema';

// JSON 파싱 부분 수정
const jsonMatch = fullResponse.match(/\{[^}]+\}/);
if (jsonMatch) {
  const parsed = AudioCommandSchema.safeParse(JSON.parse(jsonMatch[0]));
  
  if (parsed.success) {
    // 검증 성공 - 명령 실행
    await handleAudioCommand(parsed.data);
    cleanResponse = fullResponse.replace(jsonMatch[0], '').trim();
  } else {
    // 검증 실패 - Self-Correction 시도
    console.error('[Zod Validation Failed]', parsed.error);
    const retryPrompt = `Your previous response had invalid JSON: ${parsed.error.message}. Please try again with valid format.`;
    // 재시도 로직 구현...
  }
}
```

---

#### 2.2 컨텍스트 윈도우 관리 (Shadow State) 미구현 ⚠️
**문제:**
- AI에게 `trackCount`만 전달 (너무 단순)
- 트랙의 메타데이터(이름, 이펙트, 볼륨 등)를 전달하지 않음
- 향후 복잡한 명령 처리 불가능

**위치:**
- `src/hooks/agent/aiResponseHandler.ts` (41번 줄)

**해결 방법:**
```typescript
// src/utils/createShadowState.ts (신규)
import type { Track } from '@/types/track';

export interface ShadowState {
  tracks: {
    id: string;
    name: string;
    volume: number;
    pan: number;
    regionCount: number;
    duration: number;
    effects: string[]; // 향후 이펙트 추가 시
  }[];
  projectDuration: number;
  currentTime: number;
}

export function createShadowState(tracks: Track[], currentTime: number): ShadowState {
  return {
    tracks: tracks.map(t => ({
      id: t.id,
      name: t.name,
      volume: t.volume ?? 1,
      pan: t.pan ?? 0,
      regionCount: t.regions.length,
      duration: t.regions[0]?.audioFile.duration ?? 0,
      effects: [], // 향후 구현
    })),
    projectDuration: Math.max(...tracks.map(t => t.regions[0]?.audioFile.duration ?? 0)),
    currentTime,
  };
}
```

```typescript
// aiResponseHandler.ts 수정
import { createShadowState } from '@/utils/createShadowState';

const shadowState = createShadowState(deps.getTracks(), currentTime);

const systemPrompt = `You are an AI assistant that controls a Digital Audio Workstation (DAW).

Current Project State:
${JSON.stringify(shadowState, null, 2)}

Available Commands: PLAY, PAUSE, STOP, SET_TRACK_VOLUME, SET_TRACK_PAN
...
`;
```

---

#### 2.3 Hermes 모델 전용 프롬프트 미적용 ⚠️
**문제:**
- 문서에는 Hermes 모델을 사용한다고 했으나, 실제로는 `Qwen2-0.5B` 사용
- Hermes의 `<tool_call>` XML 구조 미사용
- 도구 호출 정확도가 낮을 수 있음

**선택지:**
1. Hermes 모델로 변경 + XML 프롬프트 적용
2. Qwen2 모델 유지 + 현재 방식 개선

**권장 사항:** 
- 우선 Qwen2로 Zod 검증 안정화 후, Hermes 전환 검토
- Hermes XML 템플릿은 별도 파일로 관리 (`src/prompts/hermes-tool-template.ts`)

---

### 🟢 Priority 3: 성능 최적화

#### 3.1 Transient Updates 패턴 미구현 ⚠️
**문제:**
- 오디오 레벨 미터, 재생 헤드 등 초당 60회 업데이트되는 UI 요소 부재
- 향후 구현 시 React 리렌더링으로 성능 저하 가능성

**예상 구현 위치:**
- `src/components/Daw/components/TrackMeter.tsx` (신규)
- `src/components/Daw/components/PlayheadBar.tsx` (신규)

**해결 방법:**
```typescript
// src/hooks/useTransientValue.ts (신규)
import { useRef, useEffect } from 'react';
import { usePlaybackStore } from '@/stores/usePlaybackStore';

/**
 * React 리렌더링을 우회하고 ref로 DOM을 직접 조작
 */
export function useTransientPlayhead(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const unsubscribeRef = useRef<() => void>();
  
  useEffect(() => {
    const unsub = usePlaybackStore.subscribe(
      (state) => state.currentTime,
      (currentTime) => {
        // DOM 직접 조작 (React 리렌더링 우회)
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Playhead 그리기 (requestAnimationFrame 내부에서 호출됨)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const x = (currentTime / projectDuration) * canvas.width;
        ctx.fillStyle = 'red';
        ctx.fillRect(x, 0, 2, canvas.height);
      },
      { fireImmediately: false } // React 리렌더링 방지
    );
    
    unsubscribeRef.current = unsub;
    
    return () => {
      unsub();
    };
  }, [canvasRef]);
}
```

---

#### 3.2 WaveSurfer와 Tone.js 이중 오디오 로딩 최적화 ⚠️
**문제:**
- `TrackComponent.tsx`에서 WaveSurfer가 오디오를 로딩
- AudioEngine이 별도로 Tone.Player에 로딩
- 동일 파일을 두 번 디코딩하는 비효율 가능

**해결 방법:**
```typescript
// WaveSurfer는 시각화만 담당, 오디오는 Tone.js가 관리
// WaveSurfer에 AudioBuffer를 직접 전달하여 중복 로딩 방지

// src/utils/audio/sharedAudioBuffer.ts (신규)
export class SharedAudioBufferCache {
  private static cache = new Map<string, AudioBuffer>();
  
  static async get(url: string): Promise<AudioBuffer> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
    
    this.cache.set(url, audioBuffer);
    return audioBuffer;
  }
}
```

---

## 🎯 리팩토링 실행 계획 (4주)

### Week 1: 메모리 누수 및 동기화 버그 수정
- [ ] AudioEngine.disposeTrack() 구현
- [ ] useTrackStore.removeTrack()에 dispose 호출 추가
- [ ] useToneTransportSync 훅 구현
- [ ] DawPage에 동기화 훅 적용
- [ ] 테스트: 트랙 20개 추가/삭제 반복 시 메모리 증가 확인

### Week 2: AI 에이전트 안정성 강화
- [ ] Zod 스키마 정의 (`audioCommand.schema.ts`)
- [ ] aiResponseHandler에 Zod 검증 적용
- [ ] Self-Correction 루프 구현 (최대 3회 재시도)
- [ ] createShadowState 유틸리티 구현
- [ ] AI 프롬프트에 Shadow State 적용
- [ ] 테스트: 100회 AI 명령 실행 시 실패율 측정

### Week 3: 성능 최적화 및 UI 개선
- [ ] SharedAudioBufferCache 구현
- [ ] WaveSurfer + Tone.js 통합 최적화
- [ ] useTransientValue 훅 구현
- [ ] PlayheadBar 컴포넌트 구현 (Canvas 기반)
- [ ] TrackMeter 컴포넌트 구현 (향후 레벨 미터용)
- [ ] 테스트: React Profiler로 리렌더링 횟수 측정

### Week 4: 문서화 및 테스트
- [ ] 각 규칙별 Compliance Checklist 작성
- [ ] TypeScript 타입 정밀도 향상 (any 제거)
- [ ] E2E 테스트 시나리오 작성
- [ ] 성능 벤치마크 문서 작성
- [ ] Hermes 모델 전환 가이드 작성

---

## 📂 신규 파일 목록

```
src/
├── hooks/
│   ├── useToneTransportSync.ts          # Tone.Transport <-> UI 동기화
│   └── useTransientValue.ts             # 고성능 리렌더링 우회
├── utils/
│   ├── createShadowState.ts             # AI용 경량 상태 요약
│   └── audio/
│       └── sharedAudioBuffer.ts         # 오디오 버퍼 캐싱
├── types/
│   └── audioCommand.schema.ts           # Zod 스키마 정의
└── components/
    └── Daw/
        └── components/
            ├── PlayheadBar.tsx          # 재생 위치 표시
            └── TrackMeter.tsx           # 레벨 미터 (향후)
```

---

## 🔍 규칙별 준수 현황 (Before → After)

| 규칙 | Before | After (목표) |
|------|--------|--------------|
| COOP/COEP 헤더 | ✅ 완료 | ✅ 유지 |
| Web Worker 격리 | ✅ 완료 | ✅ 유지 |
| Tone.js useRef 캡슐화 | ✅ 완료 | ✅ 유지 |
| 이중 상태 아키텍처 | ⚠️ 부분적 | ✅ 완료 (동기화 추가) |
| Zod 런타임 검증 | ❌ 미구현 | ✅ 완료 |
| Shadow State | ❌ 미구현 | ✅ 완료 |
| Hermes 프롬프트 | ❌ 미구현 | 📝 문서화 (선택 사항) |
| Transient Updates | ❌ 미구현 | ✅ 완료 |
| Dispose Pattern | ❌ 미구현 | ✅ 완료 |

---

## ⚠️ 주의 사항

1. **COOP/COEP 헤더로 인한 CORS 이슈**
   - 외부 이미지/폰트 로딩 시 `crossOrigin="anonymous"` 필수
   - 현재 프로젝트는 로컬 리소스만 사용하므로 문제 없음

2. **Tone.js Context Suspension**
   - iOS Safari에서는 사용자 제스처 없이 AudioContext 시작 불가
   - 현재 `AudioCommandType.PLAY`에서 `Tone.start()` 호출로 해결됨

3. **WebLLM 모델 크기**
   - Qwen2-0.5B는 약 350MB
   - 초기 로딩 시간 고려 필요 (현재 progress bar 구현됨)

---

## 📊 예상 효과

### 성능
- 메모리 누수 제거: 트랙 100회 추가/삭제 시 메모리 안정화
- 리렌더링 90% 감소: Transient Updates 패턴 적용 시
- 오디오 로딩 시간 50% 단축: 버퍼 캐싱 적용 시

### 안정성
- AI 명령 실패율 80% 감소: Zod 검증 적용 시
- 예기치 않은 크래시 0건: Dispose 패턴 적용 시

### 유지보수성
- 타입 안전성 향상: any 타입 제거, Zod 스키마 추가
- 코드 가독성 향상: 관심사 분리(UI ↔ Audio ↔ AI)

---

## 🚀 다음 단계 (Post-Refactoring)

1. **실시간 협업 기능**
   - WebRTC 기반 멀티 유저 세션
   - Operational Transformation (OT) 적용

2. **고급 오디오 처리**
   - VST 플러그인 (AudioWorklet 기반)
   - 실시간 피치 보정, 노이즈 제거

3. **AI 에이전트 고도화**
   - Hermes-2-Pro 모델 전환
   - Function Calling 기반 복잡한 명령 처리
   - 컨텍스트 유지 대화 (Conversation History)

---

**작성일:** 2025-01-30  
**버전:** v1.0  
**다음 리뷰:** Week 2 종료 시점

