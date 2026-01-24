# Audio Command Processing Architecture

이 문서는 프로젝트의 핵심 오디오 제어 시스템인 **Audio Command Processing** 구조를 설명합니다. 모든 오디오 관련 작업(재생, 정지, 구간 설정, 내보내기 등)은 `execute`라는 단일 진입점을 통해 중앙화되어 처리됩니다.

---

## 🏗️ Architecture Overview

모든 입력 소스(터미널, 버튼 등)는 직접 비즈니스 로직을 호출하지 않고, **Command Pattern**을 사용하여 `useAudioCommand` 훅의 `execute` 함수로 명령 객체를 전달합니다.

### Data Flow Diagram

```mermaid
graph TD
    subgraph Inputs ["Input Sources (UI Layer)"]
        Agent[🤖 Agent Terminal]
        CLI[💻 CLI Terminal]
        Btn[🔘 Export Button]
    end

    subgraph Controller ["Command Controller"]
        Execute[⚡ useAudioCommand.execute()]
    end

    subgraph Handlers ["Handlers & Logic"]
        Service[🎵 AudioService]
        Store[💾 usePlaybackStore]
        Exporter[📦 exportProject]
    end

    Agent -->|"{ type: PLAY }"| Execute
    CLI -->|"{ type: EXPORT_AUDIO }"| Execute
    Btn -->|"{ type: EXPORT_AUDIO }"| Execute

    Execute -->|Switch Command Type| Handlers

    Service -->|PLAY, PAUSE, STOP...| Tone[Tone.js Engine]
    Store -->|SET_EXPORT_RANGE...| UI[UI State Update]
    Exporter -->|EXPORT_AUDIO| File[File Download]
```

---

## 🔄 Process Details

### 1. Input Layer (명령 발생)
모든 UI 컴포넌트는 `AudioCommand` 객체를 생성하여 `execute` 함수를 호출합니다.

- **Agent Terminal**: AI가 생성한 JSON 응답을 파싱하여 명령 전달
- **CLI Terminal**: 사용자가 입력한 텍스트 명령을 JSON으로 파싱하 전달
- **Export Button**: 버튼 클릭 시 `EXPORT_AUDIO` 명령 객체 생성 후 전달

**Example (Agent Terminal Logic):**
```typescript
// aiResponseHandler.ts
for (const command of commands) {
  await execute(command); // 모든 명령을 execute 하나로 통합 처리
}
```

### 2. Command Controller (명령 분배)
`src/logics/audio/useAudioCommand.ts`에 위치한 `execute` 함수는 들어온 명령의 `type`을 확인하고 적절한 핸들러로 라우팅합니다.

**Key Logic:**
```typescript
const execute = useCallback(async (command: AudioCommand) => {
  switch (command.type) {
    // 1. Core Audio Control -> AudioService
    case 'PLAY': await service.play(); break;
    case 'LOAD_REGION': await service.addRegion(...); break;

    // 2. Global State Control -> usePlaybackStore
    case 'SET_EXPORT_RANGE': 
      setExportRange(command.startTime, command.endTime); 
      break;

    // 3. Complex Operations -> Dedicated Logic Hooks
    case 'EXPORT_AUDIO': 
      await exportProject({ filename: command.filename }); 
      break;
  }
}, []);
```

### 3. Execution Layer (실제 수행)

| Command Type | Handler | Description |
|---|---|---|
| `PLAY`, `PAUSE`, `STOP` | **AudioService** | Tone.js Transport 제어 및 오디오 엔진 동기화 |
| `LOAD_REGION` | **AudioService** | Tone.Player 생성 및 트랙에 오디오 로드 |
| `SET_VOLUME/PAN` | **AudioService** | 트랙별 볼륨/팬 조절 (실시간 반영) |
| `SET_EXPORT_RANGE` | **usePlaybackStore** | UI에 내보내기 구간 표시 (TimeRuler 하이라이트) |
| `EXPORT_AUDIO` | **useProjectExport** | 현재 트랙 상태를 기반으로 오프라인 렌더링 후 WAV 다운로드 |

---

## ✅ Benefits of This Structure

1.  **단일 진실 공급원 (Single Source of Truth)**
    *   오디오 제어 로직이 `useAudioCommand` 한 곳에 모여 있어 로직 파편화를 방지합니다.
    *   "어디서는 되고 어디서는 안 되는" 버그를 원천 차단합니다.

2.  **확장성 (Extensibility)**
    *   새로운 기능을 추가할 때 `AudioCommandType`과 `execute` 내부의 `switch` 문만 확장하면, Agent와 CLI에서 즉시 해당 기능을 사용할 수 있습니다.

3.  **유지보수성 (Maintainability)**
    *   UI 컴포넌트(`ExportButton` 등)는 단순히 명령을 "요청"하는 역할만 하며, 복잡한 비즈니스 로직(파일 생성, 엔진 제어 등)을 알 필요가 없습니다.

4.  **일관된 사용자 경험 (Consistent UX)**
    *   버튼을 누르든, 채팅으로 시키든, 명령어로 치든 똑같은 코드가 실행되어 동일한 결과를 보장합니다.
