import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import type { SessionStore } from '../session/session';
import { PlaybackController } from './playback-controller';
import { TrackController } from './track-controller';

/**
 * Controller Facade
 * 컨트롤러를 클래스로 정의한 이유는, 오디오 엔진과 세션 스토어를 항상 주입받아야하는 컨트롤러의 특성상, 생성 시점에 한번만 주입받아 객체 내부 상태로 보관하고 메서드 단위로 일관되게 사용하는것이 적합하다고 판단하였습니다. 

또한 도구로서 쓰여야 하기때문에, 클래스를 통해 외부에서 내부 구현을 직접 수정하지 못하도록 캡슐화 할 수 있고, 특히 엔진을 private 멤버로 두어 직접 변경을 방지할 수 있습니다. 

그리고 playback, track 같은 하위컨트롤러를 한 곳에서 조합, 관리함으로써 유스케이스별로 그룹화하기 쉬워지고 파사드 구조를 적용하기에도 유리합니다. 

또한, 생성자 주입 패턴을 이용해서 오디오 엔진 구현체를 tone.js에 고정하지않고 다른 구현체로 쉽게 교체할 수 있어 확장성이 높아지며, 테스트시 Mock, stub 주입이 가능해 단위테스트 작성과 유지보수에도 유리합니다.
 */
export class AppController {
  //Facade 패턴: 여러기능을 하나의 단순한 입구로 묶어주는 패턴
  //프로퍼티를 명시적으로 선언하고, 오디오 엔진은 인터페이스타입으로 참조하게 하여 안전하게 격리했습니다.
  //또한 엔진은 private 멤버로 두어 외부에서 직접 참조하거나 변경하는것을 차단했습니다.
  public readonly playback: PlaybackController;
  public readonly track: TrackController;
  public readonly session: SessionStore;
  private readonly audioEngine: IAudioEngine;
  //다른객체로 교체 불가
  //생성될때 조립되고, 내부 부품이 바뀌지 않는 구조

  //외부에서 의존성 주입
  //IAudioEngine 인터페이스에 의존 > 구체적인 구현은 몰라도 된다. (안전하게 격리)
  //구현체가 아니라 추상화에 의존! > 결합도를 낮추고, App controller가 파사드로서 유스케이스를 일관되게 조합, 격리하도록 설계했습니다.
  constructor(sessionStore: SessionStore, audioEngine: IAudioEngine) {
    this.session = sessionStore;
    this.audioEngine = audioEngine;
    this.playback = new PlaybackController(sessionStore, audioEngine); //하위 컨트롤러에 동일한 의존성 주입
    this.track = new TrackController(sessionStore, audioEngine);
  }

  //위임 메서드. 필요한 기능만 외부에서 접근가능하게 열어줌
  public getDebugInfo(): string {
    return this.audioEngine.getDebugInfo();
  }

  //비동기 오디오 렌더, 인코딩 완료를 기다리기 위해 async
  public async exportSession(
    duration: number,
    filename: string
  ): Promise<void> {
    //비동기 작업이 끝나긴 하는데 최종적으로 반환값은 없는 Promise
    const { tracks } = this.session.getState(); //vanilla store라서 class에서도 접근 가능
    const blob = await this.audioEngine.exportSession(duration, tracks); //비동기(Promise)

    // Trigger Download
    // 파일 다운로드 강제 시작
    const url = URL.createObjectURL(blob); //blob을 url로 변환
    const a = document.createElement('a'); //a 태그 생성
    a.href = url;
    a.download = filename; //이 앵커는 열지말고 다운로드만 해라. 기본파일명은 filename
    a.click(); //클릭이벤트 실행 > 자동 다운로드 시작
    URL.revokeObjectURL(url); //url 해제
  }
}

//싱글톤으로 하고싶어서 클래스로 생성??
//합치는 코드가 react app 에 있어야해서.. 클래스코드로...
