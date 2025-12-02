# 룰러 시스템 미구현 기능

## 1. 룰러 가시성 UI 제어
**현재 상태**: `handleVisibilityChange` 함수가 주석 처리됨

**Ardour 기능**: 룰러를 우클릭하면 메뉴가 나타나고, 각 룰러 타입(BBT, Timecode, Samples, MinSec)의 표시/숨김을 제어할 수 있음

**구현 필요**:
- 룰러 우클릭 컨텍스트 메뉴
- 각 룰러 타입별 체크박스 메뉴 아이템
- `handleVisibilityChange` 함수 활성화
- 세션 저장/로드 시 룰러 가시성 상태 복원

**참고**: `reference/ardour/gtk2_ardour/editor_rulers.cc`의 `popup_ruler_menu()`, `store_ruler_visibility()`, `restore_ruler_visibility()` 함수

---

## 2. 레이블 길이 제한 (maxChars)
**현재 상태**: `maxChars` 파라미터가 Metric 인터페이스에 정의되어 있지만 사용되지 않음

**Ardour 기능**: 줌 레벨이 낮을 때 레이블이 겹치면 짧게 표시하거나 생략

**구현 필요**:
- 레이블 텍스트 길이 계산
- `maxChars`에 따라 레이블 축약 또는 생략
- 레이블 간 최소 간격 유지

**예시**:
- `maxChars: 5`일 때 "00:01:23" → "01:23" 또는 "1:23"
- 레이블이 너무 가까우면 일부 생략

---

## 3. 추가 룰러 타입
**현재 구현**: BBT, Timecode, Samples, MinSec

**Ardour 추가 타입**:
- Meter (미터/박자표)
- Tempo (템포)
- Range Marker (범위 마커)
- Marker (일반 마커)
- Arrangement (섹션)
- Video Timeline

---

## 4. 룰러 스케일링 최적화
**현재 상태**: 기본적인 자동 스케일링 구현됨

**개선 필요**:
- 레이블 겹침 감지 및 자동 조정
- 픽셀 단위 정밀도 계산
- `unitsPerPixel` 기반 동적 간격 조정

---

## 5. 룰러 클릭/드래그 개선
**현재 상태**: 기본 클릭/드래그 구현됨

**Ardour 기능**:
- 우클릭: 컨텍스트 메뉴
- 드래그: 스크러빙 (재생 위치 변경)
- 더블클릭: 특정 위치로 이동

---

## 6. 세션 저장/로드
**현재 상태**: 룰러 가시성 상태가 세션에 저장/로드되지 않음

**구현 필요**:
- 세션 데이터에 `RulerVisibility` 저장
- 세션 로드 시 룰러 가시성 복원
- 기본값 설정 (AudioTime 도메인: MinSec, Timecode 활성화)


