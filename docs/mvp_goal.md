좋아. 포트폴리오 기준으로 먹히는 방향으로 **작고 강한 MVP**로 잡아볼게요.

**MVP 목표**
> 브라우저에서 실행되는 Web DAW 코어 위에, `Plugin SDK`로 확장 가능한 음향 플러그인 2종과, 이를 조작하는 `AI Agent`를 붙인다.

사용자가 MVP에서 할 수 있어야 하는 것:
1. `drop.ai` 웹에 접속한다.
2. 기본 세션을 연다.
3. 오디오 트랙을 1개 만든다.
4. 플러그인 2개 중 하나를 설치한다.
5. 파라미터를 UI로 조절한다.
6. AI에게 자연어로 플러그인 설치/파라미터 변경을 시킨다.
7. Dev Center에서 플러그인 manifest와 로그를 본다.

**MVP에 포함할 것**
- Headless DAW core
- Command Facade
- Plugin Manifest + Plugin SDK
- Plugin Host
- AudioWorklet 기반 effect plugin 2개
- Template UI panel
- AI Agent의 query/command loop
- Dev Center(등록/검증/로그)

**MVP에서 제외할 것**
- 멀티트랙 복잡 편집
- 외부 개발자용 완전한 업로드 마켓
- 임의 JS 완전 샌드박스 보안
- 협업, 계정, 저장소 동기화
- VST/AU 같은 네이티브 플러그인 호환

**권장 리포 구조**
```txt
apps/web
packages/core
packages/plugin-sdk
packages/plugin-host
packages/plugins/gain
packages/plugins/saturation
```

**6단계 MVP 플랜**

1. **Core 최소화**
목표: 코어를 작고 설명 가능하게 만든다.
- `Session`, `Track`, `PluginInstance`, `Parameter`, `CommandExecutor`
- Command 종류는 최소만
  - `ADD_TRACK`
  - `INSTALL_PLUGIN`
  - `REMOVE_PLUGIN`
  - `SET_PLUGIN_PARAMETER`
- Zod 검증 + undo/redo
- 성공 기준: UI 없이도 명령으로 세션 상태 변경 가능

2. **Plugin 규격 만들기**
목표: 코어 직접 접근 없이 플러그인을 붙일 수 있게 한다.
- `manifest.json` 스키마 정의
- `Plugin SDK` 초안 작성
- `Plugin Host`에서 manifest validate
- lifecycle: `install`, `activate`, `dispose`
- 성공 기준: 플러그인 1개를 선언형으로 등록 가능

예시:
```ts
type PluginManifest = {
  id: string;
  name: string;
  version: string;
  type: 'effect';
  parameters: Array<{ id: string; min: number; max: number; defaultValue: number }>;
  dsp: { worklet: string };
  ui: { controls: Array<{ type: 'slider'; parameterId: string }> };
};
```

3. **DSP 플러그인 2개 구현**
목표: “확장된다”를 눈으로 보여준다.
- `Gain`
- `Saturation`
- AudioWorklet로 effect 처리
- Host가 track chain에 plugin processor 연결
- 성공 기준: 두 플러그인 모두 실제 오디오에 반응

4. **Template UI + Mixer/Track Panel**
목표: 플러그인 UI를 Host가 렌더링한다.
- Track strip
- Installed plugins list
- Parameter panel
- `slider`, `toggle`만 먼저
- 플러그인이 React 직접 접근 못 하게 제한
- 성공 기준: manifest만으로 UI 패널이 뜬다

5. **AI Agent 붙이기**
목표: 사람과 AI가 같은 인터페이스를 쓴다.
- `daw_query`
- `daw_command`
- `plugin_query`
- `plugin_set_parameter`
- 간단한 step loop
- 예시 프롬프트:
  - “보컬 트랙에 saturation 걸어줘”
  - “drive를 0.4로 줄여줘”
- 성공 기준: Agent가 조회 후 명령 실행까지 완료

6. **Dev Center + 검증 흐름**
목표: 토스플레이스 느낌을 만든다.
- 플러그인 목록
- manifest validation 결과
- 권한/파라미터 표시
- 설치/제거 버튼
- 실시간 로그 패널
- 성공 기준: “플러그인 플랫폼”처럼 보이는 관리 화면 완성

**4주 일정**
- 1주차: Core + Command + 상태모델
- 2주차: Manifest + SDK + Plugin Host
- 3주차: Gain/Saturation + AudioWorklet + UI panel
- 4주차: AI Agent + Dev Center + 테스트 + 포폴 정리

**테스트 최소 기준**
- unit
  - manifest validation
  - command validation
  - plugin install/remove
  - parameter update
- e2e
  - 트랙 생성
  - 플러그인 설치
  - 파라미터 변경
  - AI로 saturation 설치
  - 로그 패널 표시

**포폴용 완료 기준**
- 스크린샷 3장
  - DAW 메인 화면
  - Plugin Dev Center
  - AI가 플러그인 설치하는 화면
- 설명 문장 3개
  - 안정적인 코어
  - Plugin SDK 확장
  - AI도 같은 Command Facade 사용

**가장 중요한 원칙**
> 플러그인은 코어를 직접 수정하지 못하고, 사람과 AI 모두 같은 Command/SDK 경로를 통과한다.

원하면 다음엔 내가 바로 이어서  
**`manifest.json` 스키마**, **패키지 구조**, **1주차 작업 체크리스트**까지 써줄게.