# 규칙

1. AudioEngine은 Controllers에서만 접근한다.
2. AudioCommand로 표현되는 작업은 CommandExecutor에서 Zod 검증 후 실행한다.
3. 검증된 명령은 CommandExecutor의 단일 대기열에서 접수 순서대로 하나씩 실행한다.
4. CommandExecutor는 실행 시점의 Session을 읽고 Controllers에 작업을 위임한다.
5. Apps는 Session을 구독해 화면을 갱신한다.
6. Tone.js와 Web Audio API는 AudioEngine에서만 접근한다.

재생 중 현재 시각처럼 Session 구독만으로 갱신되지 않는 값은 읽기 전용 Query로 조회한다. Apps에는 Controller나
AudioEngine 객체를 노출하지 않는다. 현재 `PlaybackClockQuery`는 `PlaybackController.getCurrentTime()`만 노출한다.

`executeMany`는 묶음 전체를 먼저 검증하고, 다른 명령이 끼어들지 않게 순서대로 실행한다. 실행 중 첫 오류가 나면
남은 명령은 실행하지 않는다. 이미 완료된 변경은 되돌리지 않으므로 묶음 실행은 원자적 트랜잭션이 아니다.
실패 오류는 0부터 시작하는 실패 위치, 실패 명령, 앞선 실행 결과와 원인을 보존한다. 실패한 실행 뒤에 대기 중인
요청은 계속 실행한다.
`EXPORT_AUDIO`는 현재 완료될 때까지 대기열을 점유한다. 별도 작업 모델을 도입하기 전의 알려진 제한이다.

Agent 응답은 JSON 배열 전체를 엄격하게 검증한다. 빈 배열은 명령 없음으로 허용한다. 알 수 없는 명령, 잘못된
필드, 누락·추가 필드, JSON 밖의 텍스트가 하나라도 있으면 전체를 실행하지 않는다. Agent 응답에 없는 명령을
실행 단계에서 추가하지 않는다. 검증된 배열은 `executeMany` 한 번으로 실행하며, 중간 실패 뒤 남은 명령은
실행하지 않는다.

Agent Prompt는 현재 AudioCommand 전체의 필드와 범위를 설명하고 실제 Track·Region ID, 시간 범위, 오디오 소스
사용 가능 여부를 전달한다. 예시 출력은 엄격한 Agent Schema로 테스트한다. 앱이 예약한 새 ID와 허용 파일 목록이
아직 없으므로 Agent는 `ADD_TRACK`을 만들지 않는다. `LOAD_REGION`은 기존 Track의 첫 Region 소스를 재사용할 수
있을 때만 ID 생성과 기존 URL 선택을 실행기에 맡겨 제한적으로 사용한다. 프로젝트 컨텍스트는 모델 입력 한도를
넘길 위험을 줄이도록 길이를 제한하고 잘림 여부를 표시한다.

현재 Region의 `startTime`과 `endTime`은 절대 초 단위다. 음악 시간(musical time) 모델을 도입하기 전까지 Session의
tempo 변경은 AudioEngine의 Transport BPM과 Region 예약을 변경하지 않는다.

Web UI의 Region 분할은 현재 시각에 정확히 하나의 Region이 있을 때 그 ID로 `SPLIT_REGION`을 실행한다. Region
삭제도 사용자가 확인한 정확한 ID로 `UNLOAD_REGION`을 실행한다. 내부 CLI의 변경 작업은 CommandExecutor를
사용한다. Region 이동은 드래그 중 로컬 미리보기만 갱신하고 포인터를 놓을 때 정확한 ID로 `MOVE_REGION`을 한 번
실행한다. Track 삭제는 사용자가 확인한 정확한 ID로 `REMOVE_TRACK`을 한 번 실행하고 처리 중 중복 입력을 막는다. Web
UI의 Mute·Solo는 Session 상태의 반대 값을 정확한 Track ID와 함께 `SET_TRACK_MUTE`·`SET_TRACK_SOLO`로 실행한다.
Web UI의 Tempo 입력은 `SET_TEMPO`로 Session 메타데이터만 변경한다. Web 파일 가져오기는 Track 생성과 Region 등록을
`executeMany` 한 번으로 실행한다. Web JSON CLI도 파싱된 명령 배열을 `executeMany` 한 번으로 실행하고, 중간 실패 전
결과만 후처리한다. 기존 Track의 `Region 추가`는 브라우저가 파일을 검증·변환한 뒤 선택한 Track ID와 현재 시각으로
`LOAD_REGION`을 한 번 실행한다. 성공한 파일만 Session에 보관하고 실패한 Blob URL은 해제한다.

## Architecture (Layers)

```mermaid
graph TD
    Apps["Apps (CLI, Web, Agent)"]
    Commands["CommandExecutor"]
    Queries["Read-only Queries"]
    Controllers["Controllers (AppController Facade)"]
    Session["Session (Zustand Vanilla Store)"]
    AudioEngine["Audio Engine"]
    ToneJS["Tone.js / WebAudio"]
    CreateApp["createApp (Composition Root)"]

    Apps -->|Execute AudioCommand| Commands
    Apps -->|Read Current Clock| Queries
    Commands -->|Validate & Delegate| Controllers
    Commands -->|Read Current State| Session
    Apps -->|Subscribe| Session
    Apps -.->|Create via| CreateApp

    Controllers -->|Use| AudioEngine
    Controllers -->|Update| Session
    Queries -->|Read Only| Controllers

    AudioEngine -->|Wrap / Use| ToneJS

    CreateApp -->|Create| AudioEngine
    CreateApp -->|Create| Session
    CreateApp -->|Create & Inject Deps| Controllers
    CreateApp -->|Create & Inject Deps| Commands
    CreateApp -->|Create & Inject Deps| Queries
```

> **Note:** `records/` 디렉터리의 문서들은 마이그레이션 이전 구현 기록이다. 현재 아키텍처 가이드로 참고하지 않는다.
