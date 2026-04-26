import React, { createContext, use, useMemo } from 'react';
import { useStore } from 'zustand';
import { createApp } from '../create-app';
import { type IAudioEngine } from '../../audio-engine/i-audio-engine';
import { type SessionStore, type SessionData } from '../../session/session';
import type { AppController } from '@/layers/controllers';

interface LayerContextValue {
  session: SessionStore;
  controller: AppController;
}

const LayerContext = createContext<LayerContextValue | null>(null); //null check

interface LayerProviderProps {
  engine: IAudioEngine;
  children: React.ReactNode;
}

export const LayerProvider: React.FC<LayerProviderProps> = ({
  engine,
  children,
}) => {
  //반환값을 value 로 메모이제이션한다. 의존성 배열은 [engine]이다. 
  const value = useMemo(() => createApp(engine), [engine]);

  //LayerContext에 value를 전달하고, children 을 감싸서 반환한다. 
  return (
    <LayerContext value={value}>{children}</LayerContext>
  );
};

/**
 * Internal hook to access the context
 */
function useLayer() {
  //use(LayerContext) 로 LayerContext값을 읽어 context 변수에 저장합니다. 
  const context = use(LayerContext);
  //context가 null이면, Layer Provider 바깥에서 호출된 상황이므로 에러를 던집니다. 
  if (!context) { 
    throw new Error('useLayer must be used within a LayerProvider');
  }
  //null 체크후 유효한 context를 반환합니다. 
  return context;
}

/**
 * Hook to access the AppController for executing actions.
 */
export function useController(): AppController { //AppController를 반환타입으로 갖는
  return useLayer().controller; //반환값은 useLayer()의 반환값에서 controller를 꺼내 반환합니다. 
  //useLayer가 제공하는 컨텍스트 값에서 controller 를 반환합니다. 
  //함수 호출 결과에서 프로퍼티를 바로 꺼내는 문법 (함수호출.점표기법)
}

/**
 * Custom hook to subscribe to the Session state reactively.
 * Bridges Zustand Vanilla Store to React.
 */
//매개변수 selector 는 
export function useSession<T>(selector: (state: SessionData) => T): T {  //: T useSession 의 반환타입 선언 
  //selector는 sessionData 타입의 state를 입력 받아서 T 타입 값을 반환하는 함수 매개변수다
  const { session } = useLayer(); //useLayer로 컨텍스트를 가져온 뒤 session 스토어를 꺼냅니다. 
  //객체 구조분해 할당> 반환 객체에서 session 속성만 꺼내 변수로 만든다. 
  return useStore(session, selector); //session store와 selector를 인수로 넘겨 선택된 상태를 반환한다. 
}

/*
function sum(a, b) {} // a, b = 인자(매개변수)
sum(1, 2);            // 1, 2 = 인수
*/

//store(session, selector)
//store 인스턴스, selector 함수((state)=> state.000)) 를 인자로