# Infrastructure Layer (인프라 계층 / 어댑터)

이 디렉토리는 `core` 계층에서 정의한 인터페이스의 실제 구현체를 포함합니다.
순수 도메인 로직과 외부 세계(브라우저, 오디오 엔진 등) 사이의 어댑터 역할을 합니다.

## 모듈 구성

- `audio/`: Tone.js를 사용한 AudioBackend 구현체.
