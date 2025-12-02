/**
 * Bus - 믹싱 버스 클래스
 * Ardour의 Bus 클래스를 참고하여 구현
 * 
 * Bus는 여러 Track의 출력을 합쳐서 처리하는 Route입니다.
 * Track과 달리 Playlist를 가지지 않으며, 주로 그룹 처리나 서브믹스에 사용됩니다.
 */

import { Route } from './Route';
// Web Audio API 타입은 브라우저 내장이므로 별도 import 불필요

/**
 * Bus - 믹싱 버스
 * 여러 Route의 출력을 받아서 처리하는 Route
 */
export class Bus extends Route {
  constructor(context: AudioContext, name: string) {
    super(context, name);
  }

  /**
   * Track인지 확인 (Route 추상 메서드 구현)
   */
  isTrack(): boolean {
    return false;
  }

  /**
   * Bus인지 확인 (Route 추상 메서드 구현)
   */
  isBus(): boolean {
    return true;
  }
}

