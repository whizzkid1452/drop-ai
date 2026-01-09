# Audio Command System 가이드

Drop AI DAW의 AI Agent Terminal과 CLI Terminal에서 사용 가능한 모든 오디오 커맨드와 시스템 프롬프트 제작 가이드입니다.

## 📋 목차

1. [전체 명령어 목록](#전체-명령어-목록)
2. [각 명령어 상세 설명](#각-명령어-상세-설명)
3. [시스템 프롬프트 작성 가이드](#시스템-프롬프트-작성-가이드)
4. [사용 예시](#사용-예시)

---

## 전체 명령어 목록

| 명령어 타입          | 설명                 | 파라미터                                                  |
| -------------------- | -------------------- | --------------------------------------------------------- |
| `PLAY`               | 재생 시작            | 없음                                                      |
| `PAUSE`              | 일시정지             | 없음                                                      |
| `STOP`               | 정지 및 처음으로     | 없음                                                      |
| `SET_CURRENT_TIME`   | 특정 시간으로 이동   | `time` (초)                                               |
| `SET_TRACK_VOLUME`   | 트랙 볼륨 설정       | `trackId`, `volume` (0.0-1.0)                             |
| `SET_TRACK_PAN`      | 트랙 팬 설정         | `trackId`, `pan` (-1.0~1.0)                               |
| `GET_TRACK_INFO`     | 트랙 정보 조회       | 없음                                                      |
| `SET_EXPORT_RANGE`   | Export 구간 설정     | `startTime`, `endTime` (초)                               |
| `CLEAR_EXPORT_RANGE` | Export 구간 초기화   | 없음                                                      |
| `EXPORT_AUDIO`       | 오디오 Export 실행   | 없음                                                      |
| `LOAD_REGION`        | 리전 로드 (내부용)   | `trackId`, `regionId`, `url`, `startTime`, `startOffset?` |
| `UNLOAD_REGION`      | 리전 언로드 (내부용) | `trackId`, `regionId`                                     |

---

## 각 명령어 상세 설명

### 1. 재생 제어

#### PLAY

```json
{ "type": "PLAY" }
```

- 오디오 재생 시작
- Transport를 시작하고 모든 트랙 재생
- Store의 `isPlaying` 상태를 `true`로 설정

#### PAUSE

```json
{ "type": "PAUSE" }
```

- 재생 일시정지
- 현재 위치 유지
- Store의 `isPlaying` 상태를 `false`로 설정

#### STOP

```json
{ "type": "STOP" }
```

- 재생 정지 및 처음(0초)으로 이동
- Store의 `isPlaying` → `false`, `currentTime` → `0` 설정

### 2. 시간 제어

#### SET_CURRENT_TIME

```json
{ "type": "SET_CURRENT_TIME", "time": 30.5 }
```

- **파라미터:**
  - `time` (number): 이동할 시간 (초 단위, 소수점 가능)
- 특정 시간으로 재생 위치 이동
- Store의 `currentTime` 업데이트

### 3. 트랙 제어

#### SET_TRACK_VOLUME

```json
{ "type": "SET_TRACK_VOLUME", "trackId": "uuid-here", "volume": 0.8 }
```

- **파라미터:**
  - `trackId` (string): 트랙의 UUID
  - `volume` (number): 볼륨 (0.0 = 무음, 1.0 = 최대)
- 특정 트랙의 볼륨 설정
- Store의 해당 트랙 volume 업데이트

#### SET_TRACK_PAN

```json
{ "type": "SET_TRACK_PAN", "trackId": "uuid-here", "pan": -0.5 }
```

- **파라미터:**
  - `trackId` (string): 트랙의 UUID
  - `pan` (number): 팬 값 (-1.0 = 완전 좌, 0 = 중앙, 1.0 = 완전 우)
- 특정 트랙의 팬 설정
- Store의 해당 트랙 pan 업데이트

#### GET_TRACK_INFO

```json
{ "type": "GET_TRACK_INFO" }
```

- 모든 트랙의 정보 조회
- 트랙 ID, 이름, 볼륨, 팬 등 반환
- Volume/Pan 설정 전 trackId를 얻기 위해 사용

### 4. Export 기능

#### SET_EXPORT_RANGE

```json
{ "type": "SET_EXPORT_RANGE", "startTime": 5, "endTime": 15 }
```

- **파라미터:**
  - `startTime` (number): 시작 시간 (초)
  - `endTime` (number): 종료 시간 (초)
- Export할 구간을 설정
- PlaybackStore에 `exportStartTime`, `exportEndTime` 저장
- Ruler에서 드래그한 것과 동일한 효과
- **구간은 지속됨** (초기화하거나 새로 설정할 때까지)

#### CLEAR_EXPORT_RANGE

```json
{ "type": "CLEAR_EXPORT_RANGE" }
```

- Export 구간 초기화
- PlaybackStore의 `exportStartTime`, `exportEndTime`을 `null`로 설정
- 다음 export는 전체 프로젝트로 실행됨
- Ruler 더블 클릭과 동일한 효과

#### EXPORT_AUDIO

```json
{ "type": "EXPORT_AUDIO" }
```

- 오디오 파일로 export 실행
- **현재 Store에 저장된 구간 사용**
  - 구간 설정됨: 해당 구간만 export
  - 구간 없음: 전체 프로젝트 export
- 파일명 자동 생성:
  - 구간 있음: `export_5-15s.wav`
  - 구간 없음: `export.wav`

### 5. 리전 제어 (내부 사용)

#### LOAD_REGION

```json
{
  "type": "LOAD_REGION",
  "trackId": "uuid",
  "regionId": "uuid",
  "url": "blob:...",
  "startTime": 0,
  "startOffset": 0
}
```

- 오디오 리전 로드 (일반적으로 UI에서 자동 처리)
- Tone.js Player 생성 및 동기화

#### UNLOAD_REGION

```json
{ "type": "UNLOAD_REGION", "trackId": "uuid", "regionId": "uuid" }
```

- 오디오 리전 언로드 및 메모리 해제

---

## 시스템 프롬프트 작성 가이드

### 기본 구조

```typescript
export const getSystemPrompt = ({ trackCount }) => `
1. 역할 정의
2. 사용 가능한 명령어 목록
3. 중요 사항/제약조건
4. 응답 규칙
5. 예시
`;
```

### 1. 역할 정의

- AI의 역할 명확히 정의
- 접근 가능한 리소스 언급 (트랙 개수 등)

```
You are an AI assistant that controls a Digital Audio Workstation (DAW).
You have access to ${trackCount} tracks.
```

### 2. 명령어 목록

- **모든 사용 가능한 커맨드 나열**
- JSON 형식 예시 제공
- 파라미터 타입 및 범위 명시

```
AVAILABLE COMMANDS:

1. PLAY - Start playback
   {"type":"PLAY"}

2. SET_EXPORT_RANGE - Set time range for export (in seconds)
   {"type":"SET_EXPORT_RANGE","startTime":5,"endTime":15}
   ...
```

### 3. 중요 사항 및 Command Format (매우 중요) ⭐

AI가 복합 명령을 올바르게 처리하기 위해 다음 사항을 명시해야 합니다.

```
COMMAND FORMAT:
- Single command: {"type":"PLAY"}
- Multiple commands: [{"type":"SET_EXPORT_RANGE","startTime":10,"endTime":20},{"type":"EXPORT_AUDIO"}]
- Commands in array are executed sequentially
- CRITICAL: When user asks to "export from X to Y", you MUST return an array with [SET_EXPORT_RANGE, EXPORT_AUDIO]
- NEVER return just SET_EXPORT_RANGE if the user asks to "export" or "download" -> This is WRONG!
- CORRECT Example: [{"type":"SET_EXPORT_RANGE","startTime":10,"endTime":20},{"type":"EXPORT_AUDIO"}]
```

### 4. 응답 규칙

- 응답 형식 지정
- JSON 위치 명시 (마지막 줄)
- 완료 메시지 확인

```
RESPONSE RULES:
- Keep responses SHORT and friendly
- JSON command MUST be on the LAST LINE
- If user asks a general question (not a command), respond without JSON
- Always confirm completion clearly (e.g., "완료했습니다", "Done", "설정 완료")
```

### 5. 예시

- **중요:** 배열 예시는 반드시 **한 줄(Single Line)**로 작성해야 안전합니다.

```
EXAMPLES:

User: "Play music"
Assistant: 재생을 시작합니다.
{"type":"PLAY"}

User: "10초부터 20초까지 내보내줘"
Assistant: 구간을 설정하고 export를 시작합니다.
[{"type":"SET_EXPORT_RANGE","startTime":10,"endTime":20},{"type":"EXPORT_AUDIO"}]

User: "Export"
Assistant: 현재 설정된 구간으로 export를 시작합니다.
{"type":"EXPORT_AUDIO"}
```

---

## 사용 예시

### 시나리오 1: 구간 Export (복합 커맨드)

**CLI Terminal:**

```json
[
  { "type": "SET_EXPORT_RANGE", "startTime": 10, "endTime": 30 },
  { "type": "EXPORT_AUDIO" }
]
```

**Agent Terminal:**

```
User: 10초부터 30초까지 바로 export해줘
AI: 구간을 설정하고 export를 시작합니다.
    [{"type":"SET_EXPORT_RANGE","startTime":10,"endTime":30},{"type":"EXPORT_AUDIO"}]
```

### 시나리오 2: 전체 Export

**CLI Terminal:**

```json
[{ "type": "CLEAR_EXPORT_RANGE" }, { "type": "EXPORT_AUDIO" }]
```

**Agent Terminal:**

```
User: 전체 프로젝트 export해줘
AI: 전체 export를 진행합니다.
    [{"type":"CLEAR_EXPORT_RANGE"},{"type":"EXPORT_AUDIO"}]
```

---

## 주요 원칙

### ✅ DO

- 짧고 명확한 응답
- JSON은 항상 마지막 줄
- 파라미터 타입 및 범위 준수
- trackId 필요 시 GET_TRACK_INFO 먼저 호출
- 시간은 항상 초 단위 사용
- 여러 작업 수행 시 **JSON 배열** 사용
- **중요:** Export 구간 지정 요청 시 반드시 `EXPORT_AUDIO`까지 포함된 배열 반환

### ❌ DON'T

- 파라미터 없는 커맨드에 불필요한 파라미터 추가
- JSON을 중간에 삽입
- trackId 없이 SET_TRACK_VOLUME/PAN 호출
- 범위를 벗어나는 값 사용 (volume > 1.0, pan > 1.0 등)
- **중요:** Export 요청에 `SET_EXPORT_RANGE`만 반환 금지
