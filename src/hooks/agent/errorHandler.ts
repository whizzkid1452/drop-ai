/**
 * AI 엔진 에러를 분석하고 진단 리포트를 생성하는 함수
 * @param error 에러 객체
 * @param hardwareDetails 하드웨어 정보
 * @returns 진단 리포트 문자열
 */
export function generateErrorDiagnostic(error: Error, hardwareDetails: string): string {
    const isValidationError = 
        error.message?.includes('contain either output text') || 
        error.message === 'EMPTY_RESPONSE';

    const baseReport = `**[v2.8] AI 엔진 장애 분석 (Hybrid 모드)**
- **하드웨어:** ${hardwareDetails}
- **에러:** ${error.message}`;

    if (isValidationError) {
        return `${baseReport}

> [!IMPORTANT]
> **AI 엔진 무응답:**
> AI 엔진이 답변 생성에 실패했습니다.
> 
> **해결 방법:**
> 1. 브라우저를 강력 새로고침하세요 (Ctrl+Shift+R)
> 2. 크롬을 완전히 종료 후 다시 실행해 보세요
> 3. 명령어("재생", "볼륨 50" 등)를 입력하면 AI 없이도 실행됩니다`;
    }

    return baseReport;
}

