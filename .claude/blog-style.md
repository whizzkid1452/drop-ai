---
name: devlog-blog-style
description: Write or rewrite Korean developer blog posts in the user's signature "앨리스의 토끼굴(Alice's Rabbit Hole)" style - a calm, reflective numbered-section devlog format. Use this skill whenever the user asks to write, draft, rewrite, or polish a Korean developer blog post, devlog, work-log entry, or technical retrospective, even if they don't explicitly mention "블로그 스타일". Trigger on phrases like "블로그 써줘", "블로그 스타일로 다듬어줘", "개발로그 작성", "work-log에 작성", "이거 블로그로 정리", or when the user shares working notes/transcripts and asks to turn them into a post. Also trigger when the user says "내 스타일대로" or references prior blog posts of theirs.
---

# 개발로그 블로그 스타일 (앨리스의 토끼굴)

사용자의 실제 블로그 글 톤과 구조를 그대로 재현하기 위한 스킬. 기술 경험기 / 회고형 개발로그를 쓸 때 사용한다.

블로그 예시 글: `Canvas 단일 레이어의 한계와 SVG 분리`, `웹브라우저 멀티에디터 만들기 Part 1/2`, `AI 에이전트 코딩 시대에 front-end 개발자로서의 역할에 대한 고찰`.

## 저장 위치

작성한 글은 기본적으로 `work-log/blog/` 에 `.md` 파일로 저장한다. 파일명은 영어 kebab-case (예: `video-thumbnail-worker-step1.md`).

## 절대 규칙 (Hard Rules)

이 규칙은 예외 없이 지킨다.

1. **AI 도구 표기 금지**: "made with cursor", "claude 작성", "AI 도움" 같은 표현을 본문 어디에도 쓰지 않는다. AI로 작성했다는 흔적을 남기지 않는다.
2. **em dash(—) 금지**: 모든 긴 대시는 일반 하이픈(-) 또는 콜론(:)으로 대체한다. `—` 문자 자체를 출력하지 않는다.
3. **이모지 금지**: 본문과 섹션 제목에 이모지를 사용하지 않는다.
4. **섹션 제목은 명사형**: 서술형/감정형 제목 금지.
    - 나쁜 예: "10장 vs 60장, 정반대의 결과", "Worker가 졌다", "총 시간만으로는 부족하다"
    - 좋은 예: "측정 결과", "10장 비교", "체감 지표 재정의"
5. **과장된 구어체 금지**: "배보다 배꼽이 크다", "~의 세상", "바보 같은 실수", "~가 제일 무섭다" 같은 표현 지양. 차분하게 기술한다.

## 구조 템플릿

아래 번호 섹션 골격을 기본으로 쓴다. 글 길이에 따라 중간 섹션 수를 조정하되, **1번은 반드시 "들어가며", 마지막 번호는 반드시 "마치며"** 로 고정한다.

```
# (제목: 의문문/명사구 형태, 담백하게)

## 1. 들어가며
- 배경 1-2 문단
- 이번 작업/글의 목표 3가지 내외 (번호 리스트)
- "결론부터 적으면, ..." 한 줄 결론 선요약
- 필요하면 핵심 개념 정의 인용 박스 1개

## 2. 가설 / 문제 정의
### 2-1. 초기 가설
### 2-2. 관찰된 문제
### 2-3. 조건 정리

## 3. 측정(필요한 경우) / 실험 / 시도
### 3-1. 첫 번째 케이스
### 3-2. 두 번째 케이스

## 4. 대안 / 전략 비교
### 4-1. 배경
### 4-2. 레퍼런스
### 4-3. 비교 측정

## 5. 구현 원칙
## 6. 구현 상세
## 7. 전체 구조 (Mermaid 다이어그램)
## 8. 결과 (Before/After 표)

## N. 마치며
- 배운 점 (기술 자체보다 "태도" "관점" 위주)
- 다음 단계 체크리스트
- 관련 파일 목록 (선택)

---

## 참고
**카테고리 1 (예: 브라우저 API)**
- 링크 리스트
**카테고리 2 (예: 레퍼런스 서비스)**
- 링크 리스트
```

하위 번호는 `2-1`, `2-2` 형식 (dot이 아닌 hyphen).

## 톤과 문체

- **기본 어미**: "~했다 / ~었다 / ~이었다" 중심의 담담한 회고체. "~입니다/습니다" 쓰지 않음.
- **1인칭**: "나는" 을 가끔 쓰되 남발하지 않는다. 주어를 생략하는 경우가 더 많다.
- **감정 표현**: 절제된 1인칭 소감을 드물게 넣는다. "이 부분이 가장 뼈아팠다", "여기서 다시 확인했다" 정도가 상한선.
- **판단 진술**: 단정적으로 쓰되 근거(숫자/조건)를 바로 붙인다. "Worker가 빠르다" → "60장 구간에서 약 47.5% 빨랐다".
- **볼드**: 핵심 결론 한 문장에만 제한적으로 사용. 여러 문장을 볼드 처리하지 않는다.

## 콘텐츠 패턴

### 1. 결론 선요약 (들어가며 마지막 문단)

글의 결론을 들어가며 섹션 끝에서 미리 공개한다.

```
결론부터 적으면, **[핵심 결론 한 문장]**. 하지만 여기에 도달하기까지 [어떤 과정]을 거쳤고, 중간에 [어떤 고민]을 했다. 그 과정을 이 글에 정리했다.
```

### 2. 개념 정의 인용 박스

새로 등장하는 중요 개념은 위키피디아/MDN/공식 문서에서 정의를 인용 블록으로 삽입한다.

```markdown
> [개념 정의 원문]
> 출처: [링크 제목](https://URL)
```

주로 사용하는 출처: MDN, ko.wikipedia.org, en.wikipedia.org, 공식 문서.

### 3. 비교 표

Before/After, 전략 비교, 구간별 결과 등 숫자 비교는 표로 제시한다.

```markdown
| 전략 | first-region | generated | 판단                            |
| ---- | ------------ | --------- | ------------------------------- |
| A    | 6262.2ms     | 7213.3ms  | 총 시간은 좋지만 첫 노출이 늦다 |
```

볼드로 강조할 수치는 셀 안에서 `**값**` 처리.

### 4. 코드 블록

- 언어 태그 필수 (`ts`, `tsx`, `bash`, `mermaid` 등)
- 파일 경로는 주석으로 명시: `// useThumbnailGenerator.ts`
- 전체 구현 덤프 금지. 핵심 로직만 발췌하고, 주변은 `...` 으로 생략.
- 코드 블록 앞에 "이 코드가 무엇을 하는지" 1-2 문장 설명.

### 5. Mermaid 다이어그램

전체 구조 / 플로우 / 의사결정 트리는 Mermaid로 그린다. 주로 `graph TD` (top-down) 사용.

```markdown
​`mermaid
graph TD
  A[진입점] --> B{분기}
  B -->|조건1| C[처리1]
  B -->|조건2| D[처리2]
​`
```

### 6. 이미지/영상 placeholder

스크린샷이나 첨부 영상은 `> [이미지 삽입 - ...]` 또는 `> [영상 삽입 - ...]` 형식의 인용 블록으로 자리를 잡아둔다. 사용자가 나중에 실제 파일을 삽입할 수 있도록.

```markdown
> [이미지 삽입 - Before 측정 묶음]
>
> - 10장 기준 DOM seek 콘솔 측정 결과
> - 60장 기준 DOM seek 성능 측정 결과
```

### 7. 트레이드오프 A/B/C 비교

대안이 여럿일 때 A/B/C로 라벨링하고, 표로 비교한 뒤 선택 근거를 설명한다.

```markdown
- **A: worker-first**: 처음부터 끝까지 Worker
- **B: seek-first-1-then-worker**: 첫 1장은 seek, 이후 Worker
- **C: seek-first-10-then-worker**: 첫 10장 seek, 이후 Worker

[표로 수치 비교]

A는 [트레이드오프]. B는 [트레이드오프]. C는 [트레이드오프].
최종적으로 **B**를 기본 전략으로 정했다. 이 선택의 기준은 단일 지표가 아니었다.

- 기준 1
- 기준 2
- 기준 3
```

### 8. 마치며의 패턴

"기술 자체"보다 "태도/관점/방법론"에 대한 회고로 마무리한다.

```
이번 [작업]에서 가장 크게 배운 것은 [기술]이 아니라 **[태도/관점]**이었다.

[배운 점 1 - 한 문단]
[배운 점 2 - 한 문단]
[배운 점 3 - 한 문단]

다음 단계에서는 [후속 작업 방향].
```

좋은 마무리 문장 예시:

- "좋은 아키텍쳐는 완벽한 구조가 아니라 변경의 이유가 명확한 구조라는 것."
- "기술을 고를 때 '어떤 기술이 더 좋은가'보다 '이 데이터의 성격에 어떤 기술이 맞는가'를 먼저 묻는 것이 중요하다."
- "실패를 조금은 두려워하지 않게 된 것 같다."

### 9. 참고 섹션

글 맨 끝 `---` 구분선 아래에 "참고" 섹션. 링크를 카테고리별로 분류하고, 각 카테고리를 볼드 제목 + 리스트로 정리한다.

```markdown
---

## 참고

**브라우저 API**

- API 이름: [https://...](https://...)

**레퍼런스 서비스**

- 서비스 이름: [https://...](https://...)

**관련 이전 글**

- 본인 블로그 이전 글 제목
```

## 재작성 워크플로우

사용자가 기존 기술 노트/문서를 넘기며 "블로그 스타일로 다듬어줘" 하는 경우:

1. 원본에서 **사실 관계(숫자, 조건, 결과)**는 한 글자도 바꾸지 않는다.
2. 섹션을 위 템플릿의 번호 골격에 맞춰 재배치한다.
3. 섹션 제목을 전부 명사형으로 다듬는다.
4. 들어가며에 "결론부터 적으면..." 문단을 추가한다 (원본에 없어도).
5. 본문 안의 em dash를 모두 hyphen/colon으로 치환한다.
6. 중요 개념이 설명 없이 등장하면 인용 박스로 정의 추가. 출처 링크까지 포함.
7. 마치며 섹션을 "기술보다 태도"로 재구성한다.
8. 참고 섹션을 카테고리로 분류해 정리한다.

## 자기 점검 체크리스트

글을 저장하기 전 다음을 마지막으로 확인한다.

- [ ] 본문에 em dash(`—`) 문자가 없다 (hyphen `-` 또는 colon `:` 만 사용)
- [ ] "made with cursor / claude / AI" 등의 문구가 없다
- [ ] 이모지가 없다
- [ ] 모든 섹션 제목이 명사형이다 (서술형/감정형 아님)
- [ ] 1번 섹션은 "들어가며", 마지막 섹션은 "마치며" 이다
- [ ] 하위 번호가 `2-1`, `2-2` 형식이다 (`2.1`이 아님)
- [ ] 들어가며에 "결론부터 적으면..." 선요약이 있다
- [ ] 수치 비교가 있는 경우 표로 정리되어 있다
- [ ] 참고 섹션이 있고 카테고리별로 분류되어 있다
- [ ] 파일 경로가 `work-log/blog/[kebab-case].md` 이다

다음 스타일로 블로그를 작성한다.

work-log/blog 에 작성한다.

made with cursor, cluade 등 ai 표기 금지.

jen**.log
로그인
jen**.log
로그인
MSW(Mock Service Worker)로 더욱 생산적인 FE 개발하기
jen·2022년 11월 4일

팔로우
MSW
FE 개발의 불편함
일반적인 Mocking 방식
MSW(Mock Service Worker)란?
Service Worker란?
MSW 작동 방식
MSW 적용 예시
MSW 직접 적용하기
MSW 라이브러리 설치
브라우저에 서비스 워커 등록
Worker 설정
Worker 실행
Worker 적용 확인
요청 핸들러 작성
Service Worker 요청 테스트
MSW 다양한 사례
Cookies
Query parameters
Response patching
Mocking error responses
마무리하며
참고
javascript
목록 보기
13/17

post-thumbnail
FE 개발의 불편함
현업에서 프론트 개발을 하면서 겪게되는 불편함 중 하나가 백엔드 개발에 의존한다는 것이다. 백엔드 API가 나와야 프론트엔드에서 데이터를 가져오거나 처리할 수 있다. 따라서 기간 내 개발을 위해, 우선 화면 UI만 먼저 작업하고, 백엔드 API 완성까지 기다려야 하는 경우가 종종 있다. 예를 들어, 1차 프로젝트 개발기간이 총 3주인데 기획 / 백엔드 / 프론트엔드 작업기간이 각각 최소 10일 정도 필요하다고 할 때, 프론트엔드는 개발 도중에 API가 나올 때 까지 무한정 대기해야하는 상황이 올 수 있다.

PO: 프론트엔드 개발 혹시 어디까지 진행되셨을까요?
프론트엔드: 아직 API가 안나와서 조금 더 기다려야할 것 같습니다..🥲

만약 개발중에 추가 수정사항이 발생하더라도, API 및 백엔드 개발에 의존적인 부분이라면 위의 비효율적인 프로세스를 계속 반복해야한다. 촉박한 기간 내에 API 의존적인 개발을 하게 된다면, 프론트엔드는 기간 막바지까지 기능 개발을 해야하고 그만큼 테스트할 수 있는 시간은 줄어들게 된다.

이러한 대기 상황을 줄이고 백엔드 개발과 최대한 효율적으로 협업하기 위해 어떻게 하면 될까 고민하게 되었다. 그러던 중, 동료분께서 "백엔드 API가 나오기 전에 프론트엔드에서 msw 라는 툴을 사용해서 Mocking API로 개발하는게 어떻겠느냐"고 제안하여 적용하게 되었다.

일반적인 Mocking 방식
일반적으로 아래와 같은 방법으로 Mocking을 진행할 수 있다.

어플리케이션 내부 로직에 직업 Mocking 하기
네이티브 모듈 (http, https, XMLHttpRequest) 바꿔치기
Mocking 서버 만들기
가장 간단한 방법은 화면에 필요한 데이터 상태별로 애플리케이션에 직접 Mocking 로직을 구현하는 것이다. 구현이 쉽다는 장점이 있디만, 서비스 로직을 수정해야하고 HTTP 메서드 및 응답 상태에 따른 대응이 쉽지 않다는 단점이 있다.

두번째 방법으로는 네이티브 모듈(http, https, XMLHttpRequest)을 바꿔치기해서 원하는 응답을 받을 수 있게 Mocking 하는 것이다. 하지만 이 경우에도 실제 환경과 차이가 발생하기 때문에 end-to-end 테스트에 좋지 않다는 단점이 있다.

마지막으로는 Mocking 서버를 직접 만드는 것이다. 이 방법은 실제 서비스 로직을 수정하지 않아도 된다는 장점이 있다. 하지만, 구현하는데 꽤나 많은 시간이 들고, 실제 서버와 비슷하지만 다른 방식으로 동작하기 때문에 기존 코드를 수정해야하는 일도 생길 수 있다.

위 세 가지 방식들의 문제점을 해결할 수 있는게 바로 MSW(Mock Server Worker)를 사용한 Mocking이다. MSW를 사용하면 서비스 로직을 직접 수정할 필요도 없고, 네이티브 라이브러리를 바꿔치지 않아도 되며, 직접 모킹 서버를 구현할 필요도 없다. 또한, 어플리케이션 레벨이 아닌 네트워크 레벨에서 요청을 가로채 응답을 보내기 때문에 모든 종류의 네트워크 라이브러리 (axios, react-query 등) 및 네이티브 fetch 메서드와 함께 사용할 수 있다. 그렇다면 도대체 MSW는 어떤 라이브러리이고, 어떤 방식으로 작동하는지에 대해서 알아보자.

MSW(Mock Service Worker)란?
MSW(Mock Service Worker)는 Service Worker를 이용해 서버를 향한 실제 네트워크 요청을 가로채서(intercept) 모의 응답 (Mocked response)를 보내주는 API Mocking 라이브러리이다. MSW를 사용하면 직접 Mock 서버를 구현하지 않아도, 네트워크 수준에서 API를 Mocking 할 수 있다. Mocking 테스트를 위한 노드(node.js)환경, 개발 및 디버깅을 위한 브라우저 환경에서 모두 사용할 수 있다는 장점이 있다. 또한, 소스 코드 수정 없이 모킹이 필요한 환경에서만 MSW 인스턴스를 실행해 API Mocking을 적용할 수 있다.

MSW가 이런 기능을 제공할 수 있는 이유는 바로 Service Worker를 이용해 HTTP 요청을 가로채기 때문이다.

Service Worker란?
MDN 도큐에서는 Service Worker를 아래와 같이 정의하고 있다:

서비스 워커는 웹 응용 프로그램, 브라우저, 그리고 (사용 가능한 경우) 네트워크 사이의 프록시 서버 역할을 합니다. 서비스 워커의 개발 의도는 여러가지가 있지만, 그 중에서도 효과적인 오프라인 경험을 생성하고, 네트워크 요청을 가로채서 네트워크 사용 가능 여부에 따라 적절한 행동을 취하고, 서버의 자산을 업데이트할 수 있습니다. 또한 푸시 알림과 백그라운드 동기화 API로의 접근도 제공합니다. 출처: MDN - Service Worker API

Service Worker는 브라우저가 백그라운드에서 실행하는 스크립트로, 애플리케이션의 UI 블록 없이 연산을 처리할 수 있다. (웹 애플리케이션의 메인 스레드와 분리된 별도의 백그라운드 스레드에서 실행됨)

Service Worker는 웹 서비스와 브라우저 및 네트워크 사이에서 프록시 서버의 역할을 하며, 오프라인에서도 서비스를 사용할 수 있도록 한다. Service Worker의 수명 주기는 웹페이지와는 완전히 별개이기 때문에 아래와 같은 기능에서 많이 사용되고 있다.

높은 비용의 계산을 처리할 때, 푸시 이벤트를 생성할 때
백그라운드 데이터 동기화.
다른 출처에서의 리소스 요청을 응답.
위치정보, 자이로 센서 등 계산에 높은 비용이 들어가는 다수의 페이지에서 함께 사용할 수 있도록 데이터 업데이트를 중앙화
개발 목적으로서 CoffeeScript, Less, CJS/AMD 모듈 등의 의존성 관리와 컴파일.
백그라운드 서비스 훅
특정 URL 패턴에 기반한 사용자 지정 템플릿 제공
성능 향상. 사진 앨범의 다음 사진 몇 장처럼, 사용자가 필요로 할 것으로 생각되는 리소스의 pre-fetching 등
출처: MDN - Service Worker API
단, Service Worker는 IE와 같은 일부 브라우저에서 지원이 되지 않으며, HTTPS 보안 프로토콜 환경이 필요하다. (localhost 환경 제외). 네트워크 중간에서 연결을 가로채고 조작하는 기능 때문에 반드시 HTTPS가 제공되어야 한다.

따라서, MSW는 Service Worker 덕분에 다른 라이브러리에 종속되지 않고 호환성 문제 없이 모의 API를 작동시킨다.

MSW 작동 방식
MSW가 브라우저에서 어떻게 동작하는지 알아보자. 우선, MSW 라이브러리를 설치하면 브라우저에 Service Worker을 등록한다. 이후, 브라우저에서 이루어지는 실제 네트워크 요청들을 (예를 들어 fetch이벤트로 보낸 네트워크 요청 등) Service Worker가 가로채게 된다. Service Worker는 가로챈 요청을 복사해서 실제 서버가 아닌 클라이언트 사이드에 있는 MSW 라이브러리로 보낸 후, 등록된 핸들러를 통해 모의 응답(Mocked response)을 제공 받는다. 마지막으로, 제공받은 모의 응답(Mocked response)을 브라우저에게 그대로 전달하게 된다.

이러한 과정을 통해, 실제 서버와 직접적인 연결 없이 보내는 요청에 대한 응답을 Mocking 할 수 있게된다. 따라서, 백엔드 API가 아직 준비되지 않아도 MSW로 가상 API를 등록하고 프론트에서 테스트할 수 있다.

Mock Service Worker 다이어그램 (출처: https://mswjs.io/docs/#request-flow-diagram)

정리하자면 아래와 같다:

1. 브라우저가 Service Worker에 요청을 보냄
2. Service Worker가 해당 요청을 가로채서 복사함
3. 서버에 요청을 보내지 않고, MSW 라이브러리의 핸들러와 매칭시킴
4. MSW가 등록된 핸들러에서 모의 응답 (mocked response)를 Service Worker에게 전달함
5. 마지막으로, Service Worker가 모의 응답을 브라우저에게 전달함

참고로, Service Worker는 브라우저 환경에서만 실행 가능하다. node 환경에서는 node-request-interceptor 라이브러리를 활용해 네이티브 (http, https, XMLHttpRequest) 모듈을 확장(extending)해서 리퀘스트를 처리를 해야한다.

MSW 적용 예시
그렇다면 모의 응답을 제공하는 msw 핸들러는 과연 어떻게 생겼을까. 공식 도큐의 예시를 통해서 먼저 알아보자.

Mock Service Worker를 사용하면 선언적 요청 핸들러 (declarative request handler)를 사용하여 URL, RegExp 또는 사용자 지정 기준에 따라 요청을 가로챌 수 있게 하고, 모의 응답을 반환하는 응답 함수를 제공한다.

다음은 POST 메서드의 /login 요청을 모킹하는 msw 파일예시다.

// src/mocks.js
import { setupWorker, rest } from 'msw'

const worker = setupWorker(
rest.post('/login', (req, res, ctx) => {
const isAuthenticated = sessionStorage.getItem('username')

    if (!isAuthenticated) {
      return res(
        ctx.status(403),
        ctx.json({
          errorMessage: 'Not authenticated',
        }),
      )
    }

    return res(
      ctx.json({
        firstName: 'John',
      }),
    )

}),
)

// Register the Service Worker and enable the mocking
worker.start()
HTTP POST 요청을 처리하기 위해 rest.post 함수를 사용해 요청을 보낸다.
핸들러 함수의 첫번째 파라미터에는 '/login' 라는 요청 경로를 넣었고, 두번째 파라미터에는 response resolver라는 콜백 함수를 넣었다.
Response resolver에는 세 가지 인자를 받는다: req, res, ctx
req: 매칭되는 요청에 대한 정보
res: 모의 응답을 만들 수 있는 유틸리티
ctx: 모의 응답의 HTTP 상태 코드, 헤더, 바디 등을 만들 수 있는 함수들
위 req, res, ctx를 사용해서 원하는 조건에 따라 모의 응답을 작성한다.
사용자가 검증되었는지 isAuthenticated 여부를 세션 스토리지의 username 값으로 판별한다
만약 검증된 사용자라면 firstName: 'John' 이라는 값을 리턴한다
만약 검증되지 않았다면, 403 응답과 함께 errorMessage: 'Not authenticated' 이라는 값을 리턴한다.
최종적으로, 작성한 worker를 worker.start()로 등록한다

브라우저별로 세팅 절차가 다르기 때문에 공식 도큐 - Integrate 내용을 확인해서 세팅하면 된다. 해당 글에서는 '브라우저' 기준으로 msw를 적용할것이다.

MSW 직접 적용하기
MSW 라이브러리 설치
msw를 설치하고자 하는 프로젝트에서 npm 혹은 yarn 커맨드로 msw라이브러리를 설치할 수 있다.

npm install msw --save-dev

# or

yarn add msw --dev

브라우저에 서비스 워커 등록
브라우저에서 사용하기 위해서는 MSW를 서비스 워커에 등록하는 과정이 필요한데, 아래의 명령어를 실행하면 서비스 워커 등록을 위한 파일이 public 폴더에 추가된다.

npx msw init public/ --save
public/ 폴더는 주로 프로젝트의 정적 리소스를 담는 폴더이다. create-react-app, next.js에 기본적으로 세팅이 되어있다.

다른 프로젝트의 경우 public 디렉토리가 다를 수 있는데, 해당 링크에서 참고할 수 있다.

Worker 설정
src/mocks/browser.js 파일을 생성해서 worker 설정을 해야한다

touch src/mocks/browser.js
생성한 browser.js 파일에서 worker 인스턴스를 생성하고, 요청 핸들러를 정의한다.

// src/mocks/browser.js
import { setupWorker } from 'msw'
import { handlers } from './handlers'

// This configures a Service Worker with the given request handlers.
export const worker = setupWorker(...handlers)

Worker 실행
이제 어플리케이션 소스에 워커를 실행하는 코드를 추가하자.

// src/index.js
import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'

if (process.env.NODE_ENV === 'development') {
const { worker } = require('./mocks/browser')
worker.start()
}

ReactDOM.render(<App />, document.getElementById('root'))

Worker 적용 확인
애플리케이션을 다시 시작하고, 브라우저 콘솔에서 아래와 같은 메세지가 뜨면 모킹이 활성화된 것이다.

[MSW] Mocking enabled.
이제 개발 서버에서 앱을 실행하면, 실제 서버가 아닌 MSW에서 응답을 보낼 수 있게 된다.

요청 핸들러 작성
이제 세팅이 완료 되었으니, 서버 대신 msw에서 모의 응답을 줄 수 있도록 요청 핸들러를 작성해보자. HTTP 요청일 들어왔을 때, 내가 원하는 대로 임의의 응답을 해줄 수 있는 핸들러 코드이다.

코드는 되도록이면 mocks 폴더에 두는 것이 좋다. src/mocks/handlers.js에 요청 핸들러를 작성해보자.

import { rest } from "msw";

const posts = ["게시글1", "게시글2", "게시글3"];

export const handlers = [
// 포스트 목록
rest.get("/posts", (req, res, ctx) => {
return res(ctx.status(200), ctx.json(todos));
}),

// 포스트 추가
rest.post("/posts", (req, res, ctx) => {
posts.push(req.body);
return res(ctx.status(201));
})
];
REST API를 모킹하기 위해 MSW의 rest객체를 사용하였다. 포스트 목록을 조회하기 위한 GET /posts는 배열에 담긴 포스트를 응답해주고, 새로운 포스트 등록을 위한 POST /posts는 요청 바디로 넘어온 포스트를 배열에 추가한다.

Service Worker 요청 테스트
이제 fetch()함수로 GET /posts 요청을 보내보자. 실제 서버가 아닌, MSW에서 가짜 응답을 보내줄 것이다.

요청:
fetch("/posts")
.then((response) => response.json())
.then((data) => console.log(data));
응답:
[MSW] 18:04:24 GET /posts (200 OK)
["게시글1", "게시글2", "게시글3"]
MSW 다양한 사례
기본적인 내용 이외에도 다양한 케이스에서 msw를 활용할 수 있는 방법들이 있다. 이중, 유용하게 사용할 수 있는 네 가지 사례를 정리해보았다.

Cookies
보안상의 이유로fetch에서 Set-Cookie 및 Set-Cookie2 헤더를 설정할 수 없다.

그러나 Mock Service Worker는 클라이언트 측에서 실행되므로, 보안 위반 없이 응답으로부터 Mocked 쿠키를 수신하는 것과 유사한 기능을 제공할 수 있다. document.cookie 문자열에 지정된 쿠키를 직접 설정하는 ctx.cookie() 응답 변환기 함수(response transformer function)를 사용하면 된다.

예시

import { setupWorker, rest } from 'msw'

const worker = setupWorker(
rest.post('/login', (req, res, ctx) => {
return res(
// Calling `ctx.cookie()` sets given cookies
// on `document.cookie` directly.
ctx.cookie('auth-token', 'abc-123'),
)
}),
)

worker.start()
Query parameters
인터셉트된 요청의 쿼리 매개 변수에 액세스하려면 req.url 인스턴스에서 searchParams 속성을 사용하면 된다. 이 속성의 값은 모든 쿼리 매개 변수를 포함하는 URLSearchParams 인스턴스이다.

예를 들어, MSW로 테스트를 할 때 요청 파라미터에 따라 다른 응답을 줘야하는 경우가 있는데, 이때 핸들러에서 req 객체를 통해 파라미터에 접근이 가능하다.

import { setupWorker, rest } from 'msw'
const worker = setupWorker(
rest.get('/products', (req, res, ctx) => {
const productId = req.url.searchParams.get('id')
return res(
ctx.json({
productId,
}),
)
}),
)
worker.start()
Request

GET fetch('/products?id=123')

Response
200 OK

Body

{
// Where '123' is the value of `req.url.searchParams.get('id')`
// parsed from the request URL.
"productId": "123"
}
더 자세한 설명은 링크에서 확인할 수 있다.

Response patching
Response patching은 모의 응답(mocked response)이 실제 응답을 기반으로 데이터를 구성할 수 있게한다. 이 기법은 핸들러에서 실제 서버에 요청을 보낸 후 받은 데이터에 디버깅 등에 필요한 정보를 임의로 덧붙이는 방식으로 작동한다.

아래는 Github API v3에서 응답을 패칭하는 예시이다:

import { setupWorker, rest } from 'msw'

const worker = setupWorker(
rest.get('https://api.github.com/users/:username', async (req, res, ctx) => {
// Perform an original request to the intercepted request URL
const originalResponse = await ctx.fetch(req)
const originalResponseData = await originalResponse.json()

    return res(
      ctx.json({
        location: originalResponseData.location,
        firstName: 'Not the real first name',
      }),
    )

}),
)

worker.start()
Request

GET 'https://api.github.com/users/octocat'

Response
200 OK

Body

{
// Resolved from the original response
"location": "San Francisco",
"firstName": "Not the real first name"
}
더 자세한 설명은 링크에서 확인할 수 있다.

Mocking error responses
msw로 요청에 대한 에러 응답을 mocking 할 수도 있다. 오류 응답을 예외가 아닌 실제 응답으로 처리함으로써, 표준을 준수하고 클라이언트 코드가 유효한 오류 응답을 수신하고 처리하는지 확인할 수 있다.

아래는 로그인 POST요청에서 에러 응답을 mocking 하는 예제이다:

import { setupWorker, rest } from 'msw'

const worker = setupWorker(
rest.post('/login', async (req, res, ctx) => {
const { username } = await req.json()

    return res(
      // Send a valid HTTP status code
      ctx.status(403),
      // And a response body, if necessary
      ctx.json({
        errorMessage: `User '${username}' not found`,
      }),
    )

}),
)

worker.start()
Request

POST '/login'

Body

{
"username": "admin"
}
Response

403 Forbidden

Body

{
"errorMessage": "User 'admin' not found"
}
더 자세한 설명은 링크에서 확인할 수 있다.

마무리하며
현업에서 MSW를 도입해 개발을 하면서 굉장이 편리하다고 느꼈다.
정해진 기간에 백엔드와 프론트엔드가 동시에 개발을 시작하는데, API가 준비되지 않은 상황에서도 프론트 개발을 빠르게진행할 수 있었고, 여유롭게 개발을 마쳐 테스트 시간을 더 많이 확보할 수 있었다.
특히, 직접 네트워크 응답 상태를 조절하면서 내가 원하는 화면 (성공 화면, 로딩 화면, 에러 화면)을 더 빠르고 효율적이게 개발할 수 있었다. req에 에러코드를 전달해서 디버깅을 하는데도 쉬웠다.
개발 도중에 피드백을 하거나, 리드분께 보고하는 상황에서도 API 없이 MSW 만으로 시연이 가능해서 매우 유용했다.
또한, MSW를 활용해서 쉽게 에러 상황을 재현하는게 가능해져서 특정 상황을 재현하고 디버깅 하는데도 유용하게 사용할 수 있었다.
단점이 있다면 처음에 service worker의 개념을 이해하는데 어려움이 있었다는 정도?
결론은 API 구현을 기다리지 않고 빠르게 프론트엔드 개발을 시작하고 싶다면 MSW 도입을 적극 추천한다.

참고
Mock Service Worker로 만드는 모의 서버
MSW로 백앤드 API 모킹하기
Mocking으로 생산성까지 챙기는 FE 개발
Mock Service Worker 공식 도큐
[MDN] Service Worker API
ServiceWorker 이모저모 이야기
profile
jen

tlarbals824.log
로그인
tlarbals824.log
로그인
Zero Copy가 뭘까?
심규민·2024년 7월 19일

팔로우
JavaOS
데이터 전송(Non-Zero Copy)
데이터 전송(Zero Copy)
데이터 전송(Zero Copy With Scatter-Gather DMA)
성능 차이(Non-Zero Copy VS Zero Copy)
요약
최근 카프카 핵심 가이드에서 카프카는 consumer의 요청에 대한 응답을 할 때 zero copy를 이용해서 성능 최적화를 진행했다고 나와있었다. 그런데 zero copy가 뭘까?

데이터 전송(Non-Zero Copy)
우선 간단한 예로 접근해보자.
정적 콘텐츠를 제공하는 서버가 있을 때, 서버가 정적 콘텐츠를 제공하는 과정에서 콘텐츠 데이터를 디스크로부터 읽어와 응답 소켓으로 전송해준다. 이러한 과정에서는 cpu의 사용이 매우 작을거라 생각할 수 있다. 하지만 요청이 들어오고 응답할 때까지의 과정을 자세히 들여다보면 아주 비효율적인 부분이 존재한다.

이 과정을 그림과 코드로 표현하면 다음과 같다.

private long sendWithNonZeroCopy(SocketChannel socketChannel, FileChannel fileChannel) throws IOException {
long transferSize = 0;
ByteBuffer buffer = ByteBuffer.allocate(1024);
int numberOfReadBytes = 0;
while ((numberOfReadBytes = fileChannel.read(buffer)) != -1) {
buffer.flip();
socketChannel.write(buffer);
buffer.clear();
transferSize += Math.max(numberOfReadBytes, 0);
}
return transferSize;
}
DMA를 통해 디스크로부터 콘텐츠 데이터를 커널 영역에 존재하는 Read Buffer로 복사한다.
애플리케이션이 커널 영역에 직접 접근할 수 없기 때문에 Read Buffer(커널 영역)의 데이터를 Application Buffer(유저 영역)으로 복사한다.
데이터 전송을 위해 Application Buffer(유저 영역)의 데이터를 Socket Buffer(커널 영역)으로 복사한다.
네트워크 통신을 위해 Socket Buffer의 데이터를 NIC Buffer로 복사한다.
위 과정에서 유저 영역으로의 데이터 복사가 발생하는 것을 알 수 있다.
만일 데이터를 조회한 후 다시 사용할 수 있다면 성능상의 이점이 있겠지만, 카프카와 같이 지속적으로 새로운 데이터를 조회해야하는 경우 메모리 사용량에 있어 부담이 될 수 있다. 특히 JVM 환경에서는 메모리를 직접 제어하지 않고 GC가 메모리를 관리하며, 메모리를 정리과정에서 STW가 발생하면 요청에 대한 응답이 지연될 수 있다.

이러한 문제를 zero copy를 통해 해결할 수 있습니다.

데이터 전송(Zero Copy)
zero copy는 커널 영역에서의 버퍼간 데이터 복사를 유저 영역을 거치지 않고 바로 복사하는 방법입니다.
예전에는 JVM 환경에서는 커널 영역의 메모리를 직접 다둘수 있는 방법이 없었기 때문에 zero copy를 사용할 수 없었습니다. 하지만 Java의 NIO 패키지의 추가로 커널 영역을 직접 다룰 수 있는 transferTo와 같은 메소드를 제공하게 됐습니다.
transferTo 메소드는 커널 영역 내에서 데이터 복사를 할 때 사용하는 메소드이며, UNIX에서의 sendfile() 시스템 콜을 사용합니다.
앞선 Non-Zero Copy에서 transferTo를 활용하면 다음과 같은 그림과 코드로 나타낼 수 있습니다.

private long sendWithZeroCopy(SocketChannel socketChannel, FileChannel fileChannel) throws IOException {
return fileChannel.transferTo(0, fileChannel.size(), socketChannel); // java nio transferTo
}
DMA를 통해 디스크로부터 콘텐츠 데이터를 커널 영역에 존재하는 Read Buffer로 복사한다.
transferTo() 메소드를 통해 Read Buffer에서 Socket Buffer로 데이터를 복사한다.
네트워크 통신을 위해 Socket Buffer의 데이터를 NIC Buffer로 복사한다.
앞선 복사하는 과정에 비해 코드가 더 간결해졌으며, 유져 영역으로의 복사 과정 또한 없어져 4번의 복사과정을 3번으로 줄였습니다. 추가로 유저 영역으로의 복사가 없기 때문에 메모리를 좀 더 효율적으로 사용하게 됩니다.

여기서 더 최적화를 진행할 수 있을까요?

데이터 전송(Zero Copy With Scatter-Gather DMA)
이전 내용을 통해 Socket Buffer에서 NIC Buffer로의 데이터 복사가 이뤄짐을 알 수 있었습니다. 그런데 Read Buffer에서 NIC Buffer로의 직접 복사가 이뤄지면 좀 더 최적화할 수 있지 않을까?라는 생각이 들 수 있습니다.
이를 NIC의 Scatter-Gather DMA 기능을 통해 이룰 수 있습니다!

NIC에서 gather operation을 지원하는 경우, 이 기능을 통해 여러 메모리 영역에 분산되어 있는 데이터를 효율적으로 모아 네트워크에 전송할 수 있습니다.

즉, Socket Buffer에 Read Buffer에 담긴 데이터의 위치와 크기를 포함하는 descriptor를 생성한 뒤, NIC가 해당 descriptor를 조회하며 DMA 엔진을 통해 데이터를 NIC Buffer로 복사해올 수 있습니다.

위 과정을 그림으로 나타내면 다음과 같습니다.

DMA를 통해 디스크로부터 콘텐츠 데이터를 커널 영역에 존재하는 Read Buffer로 복사한다.
transferTo() 메소드를 통해 Socket Buffer에 descriptor를 생성하고 이를 통해 Read Buffer에서 NIC Buffer의 데이터 복사를 진행한다.
NIC의 gather operation으로 복사를 총 4번에서 2번까지 줄이게 됐습니다.

성능 차이(Non-Zero Copy VS Zero Copy)
대략 1KB크기의 파일을 10000번 전송할 때 성능을 비교해보았습니다.

loop count: 10000, Average time for zero copy: 0ms
Total time for zero copy: 1837ms
loop count: 10000, Average time for non zero copy: 0ms
Total time for non zero copy: 2535ms
대략 약 28% 줄어든 것을 확인할 수 있습니다.

관련 코드는 깃허브에서 확인할 수 있습니다.

요약
zero copy는 유저 영역으로 복사를 제거함으로써 CPU, 메모리 사용을 최적화하는 방법입니다.
Java에서는 transferTo() 메소드를 통해 쉽게 zero copy를 사용할 수 있습니다.
NIC의 gather operation을 통해 복사 수를 더 줄일 수 있다.
참고
https://f-lab.kr/insight/understanding-and-utilizing-buffering
https://m.blog.naver.com/kgw1988/221218267855
https://developer.ibm.com/articles/j-zerocopy/
https://velog.io/@jinii/%EC%A0%9C%EB%A1%9C%EC%B9%B4%ED%94%BCzero-copy

profile
심규민

팔로우
이전 포스트
단일 요청 서버에서 MVC까지
다음 포스트
스레드 풀에서 이벤트 루프까지
0개의 댓글
댓글을 작성하세요
댓글 작성
Powered by GraphCDN, the GraphQL CDN
