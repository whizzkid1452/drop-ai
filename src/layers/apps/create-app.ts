import type { IAudioEngine } from '../audio-engine/i-audio-engine';
import { createSessionStore, type SessionStore } from '../session/session';
import { AppController } from '../controllers';

export interface AppInstance {
  session: SessionStore;
  controller: AppController;
}

/**
 * Core Application Factory
 */
//인터페이스에 의존 > 구체적인 구현은 몰라도 된다.
//안전하게 격리하기위해서.. 
export function createApp(audioEngine: IAudioEngine): AppInstance { //함수의 반환 타입
  const session = createSessionStore(); //zustand vanilla store
  //react 훅이아니라 평범한 객체로 다루기 위해. 리액트 의존을 피하기 위해..
  //의존성 주입 패턴(DI) 앱컨트롤러가 세션이나 오디오엔진을 직접 만들지않고, 외부에서 주입받습니다. 
  const controller = new AppController(session, audioEngine); //new 로 클래스 객체 인스턴스 생성

  return { session, controller }; //객체 축약(변수 이름과 키 이름이 같을 때)
}

/**
 * creat-app을 composition root로 따로 둔 이유는, 의존성 생성과 연결을 한 곳에 모아 앱의 의존성 구조를 명확히 드러내기 위해서 입니다. 
 * 오디오 엔진은 외부에서 주입받고, 세션 스토어를 생성한 뒤, appController에서 엔진과 스토어의 의존성을 주입합니다. 
 * 이 구조로, 각 계층의 결합도를 낮추고, 오디오 엔진의 구현체를 쉽게 교체할 수 있어 테스트성과 확장성이 좋아집니다.
 */

//clean architecture 공부하고 전체 구조 다시 생각해보기. 