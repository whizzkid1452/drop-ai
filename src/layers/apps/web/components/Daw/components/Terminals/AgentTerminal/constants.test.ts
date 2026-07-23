import { describe, expect, it } from 'vitest';
import { QUICK_GUIDE_ITEMS } from './constants';

describe('QUICK_GUIDE_ITEMS', () => {
  it('내보내기 실행이 아닌 범위 설정 의도를 명시한다', () => {
    const exportRangeGuide = QUICK_GUIDE_ITEMS.find(item => item.label === 'Set Export Range');

    expect(exportRangeGuide?.value).toBe('set export range from 0:00 to 1:30');
  });
});
