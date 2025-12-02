# 다음 단계 작업 계획

이 문서는 reference 폴더의 Ardour 소스코드를 참고하여 다음에 구현할 기능들을 정리한 것입니다.

## 📊 현재 구현 상태 요약

### ✅ 완전 구현됨
- Session, Route, Track, Bus
- Region, AudioRegion, Playlist
- Graph, Processor (베이스)
- UndoStack, Transport, Metronome
- AudioEngine, **TempoMap** ✅

### ⚠️ 부분 구현됨
- Clip (Region/Playlist로 마이그레이션 필요)

### ❌ 미구현 (우선순위 순)

1. **ProcessorChain** - 가장 시급
2. **BufferManager** - 성능 최적화 필수
3. **SessionSerializer** - 세션 저장/로드
4. **TimeConverter** - 시간 변환 유틸 (TempoMap과 통합)

---

## 🎯 우선순위별 작업 계획

### 우선순위 1: ProcessorChain 구현

**목표**: Route에 Processor Chain 통합하여 이펙트 체인 시스템 구축

**필요 작업**:
- [ ] `src/core/audio/ProcessorChain.ts` 구현
  - Pre-Fader/Post-Fader Processor 구분
  - Send/Return 처리
  - Processor 순서 관리
  - 바이패스 지원
  - 레이턴시 계산
- [ ] Route 클래스에 ProcessorChain 통합
- [ ] ProcessorChain 테스트 작성

**참고 파일**:
- `reference/ardour/libs/ardour/ardour/processor.cc` - Processor 체인 관리
- `reference/ardour/libs/ardour/ardour/processor.h` - 인터페이스
- `reference/ardour/libs/ardour/ardour/route.cc` - Route에 ProcessorChain 통합 부분

**예상 소요 시간**: 1주

---

### 우선순위 2: BufferManager 구현

**목표**: 메모리 효율적인 AudioBuffer 관리 및 캐싱

**필요 작업**:
- [ ] `src/core/audio/BufferManager.ts` 구현
  - AudioBuffer 풀링 시스템
  - 파일별 캐싱 (Source 개념)
  - 메모리 관리 및 해제
  - 실시간 안전 할당
- [ ] AudioRegion에서 BufferManager 사용
- [ ] 메모리 사용량 모니터링

**참고 파일**:
- `reference/ardour/libs/ardour/ardour/audiosource.cc` - 오디오 소스 캐싱
- `reference/ardour/libs/ardour/ardour/audioregion.cc` - 버퍼 참조 부분

**예상 소요 시간**: 1주

---

### 우선순위 3: SessionSerializer 구현

**목표**: 세션 데이터를 JSON으로 저장/로드

**필요 작업**:
- [ ] `src/core/utils/sessionSerializer.ts` 구현
  - JSON 세션 파일 형식 정의
  - Session → JSON 직렬화
  - JSON → Session 역직렬화
  - 버전 관리
- [ ] IndexedDB 저장/로드 유틸리티
- [ ] 자동 저장 기능 (Auto-save)
- [ ] 세션 파일 검증

**참고 파일**:
- `reference/ardour/libs/ardour/ardour/session.cc` - `save_state()`, `load_state()` 메서드
- `reference/ardour/libs/ardour/ardour/session_metadata.cc` - 세션 메타데이터 관리

**예상 소요 시간**: 1주

---

### 우선순위 4: TimeConverter 유틸리티

**목표**: TempoMap과 통합된 시간 변환 유틸리티

**필요 작업**:
- [ ] `src/core/utils/timeConverter.ts` 구현
  - 초 ↔ BBT 변환 (TempoMap 사용)
  - 초 ↔ 비트 변환
  - 샘플 ↔ 시간 변환
  - 시간 포맷팅 (시간코드, BBT 등)
- [ ] TempoMap과 통합 테스트

**참고 파일**:
- `reference/ardour/libs/temporal/` - 시간 변환 유틸
- `src/core/audio/TempoMap.ts` - 기존 TempoMap 활용

**예상 소요 시간**: 3일

---

### 우선순위 5: Clip 마이그레이션

**목표**: 기존 Clip을 Region/Playlist 시스템으로 완전 전환

**필요 작업**:
- [ ] Clip 클래스 분석 및 의존성 파악
- [ ] Clip → Region/Playlist 변환 로직 작성
- [ ] UI 컴포넌트 업데이트 (Clip → Region/Playlist)
- [ ] 기존 코드 리팩토링
- [ ] 마이그레이션 테스트

**참고 파일**:
- `src/core/audio/Clip.ts` - 기존 Clip 구현
- `src/core/audio/Region.ts` - Region 베이스
- `src/core/audio/AudioRegion.ts` - AudioRegion 구현
- `src/core/audio/Playlist.ts` - Playlist 구현

**예상 소요 시간**: 1주

---

## 📁 Ardour 소스코드 핵심 파일 매핑

### Session 관리
```
reference/ardour/libs/ardour/ardour/session.h
reference/ardour/libs/ardour/ardour/session.cc
→ src/core/audio/Session.ts ✅
```

### Route 시스템
```
reference/ardour/libs/ardour/ardour/route.h
reference/ardour/libs/ardour/ardour/route.cc
→ src/core/audio/Route.ts ✅
```

### Processor Chain
```
reference/ardour/libs/ardour/ardour/processor.h
reference/ardour/libs/ardour/ardour/processor.cc
→ src/core/audio/ProcessorChain.ts ❌ (구현 필요)
```

### Region/Playlist
```
reference/ardour/libs/ardour/ardour/region.h
reference/ardour/libs/ardour/ardour/audioregion.cc
reference/ardour/libs/ardour/ardour/playlist.cc
→ src/core/audio/Region.ts ✅
→ src/core/audio/AudioRegion.ts ✅
→ src/core/audio/Playlist.ts ✅
```

### Graph 시스템
```
reference/ardour/libs/ardour/ardour/graph.h
reference/ardour/libs/ardour/ardour/graph.cc
→ src/core/audio/Graph.ts ✅
```

### Buffer 관리
```
reference/ardour/libs/ardour/ardour/audiosource.cc
→ src/core/audio/BufferManager.ts ❌ (구현 필요)
```

### TempoMap
```
reference/ardour/libs/temporal/
→ src/core/audio/TempoMap.ts ✅
```

---

## 🔧 구현 시 주의사항

### Web Audio API 제약 고려

1. **ProcessThread → AudioWorklet**
   - Ardour의 ProcessThread는 AudioWorklet으로 구현
   - 실시간 오디오 처리만 AudioWorklet에서 수행

2. **파일 I/O → File API**
   - libsndfile → File API + Web Audio API
   - 브라우저 제약 고려 (비동기 처리)

3. **메모리 관리**
   - C++의 new/delete → TypeScript의 가비지 컬렉션
   - Shared pointers → 참조 관리
   - 메모리 풀링 → 버퍼 재사용 패턴

4. **세션 저장**
   - XML → JSON
   - 파일 시스템 → IndexedDB

---

## 📅 예상 일정

### Week 1: ProcessorChain
- ProcessorChain 클래스 구현
- Route 통합
- 테스트 작성

### Week 2: BufferManager
- BufferManager 클래스 구현
- AudioRegion 통합
- 메모리 최적화 테스트

### Week 3: SessionSerializer
- SessionSerializer 구현
- IndexedDB 통합
- 자동 저장 기능

### Week 4: TimeConverter + Clip 마이그레이션
- TimeConverter 유틸리티
- Clip 마이그레이션 시작

---

## 🎯 성공 기준

각 작업 완료 기준:

1. **ProcessorChain**
   - [ ] Pre-Fader/Post-Fader 구분 동작
   - [ ] Send/Return 처리 가능
   - [ ] Route에 통합 완료

2. **BufferManager**
   - [ ] AudioBuffer 풀링 동작
   - [ ] 파일별 캐싱 동작
   - [ ] 메모리 사용량 30% 이상 감소

3. **SessionSerializer**
   - [ ] 세션 저장/로드 정상 동작
   - [ ] IndexedDB 저장/로드 정상 동작
   - [ ] 자동 저장 기능 동작

4. **TimeConverter**
   - [ ] 모든 시간 변환 함수 정상 동작
   - [ ] TempoMap과 통합 완료

5. **Clip 마이그레이션**
   - [ ] 기존 Clip 기능 모두 Region/Playlist로 전환
   - [ ] UI 정상 동작
   - [ ] 성능 저하 없음

---

## 📚 참고 문서

- [Ardour 참고 가이드](./reference/ARDOUR_REFERENCE_GUIDE.md)
- [구현 상태 확인](./reference/IMPLEMENTATION_STATUS.md)
- [프로젝트 계획](./PROJECT_PLAN.md)

