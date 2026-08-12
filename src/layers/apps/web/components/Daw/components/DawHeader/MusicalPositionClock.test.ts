import { describe, expect, it } from 'vitest';
import { formatMusicalPosition } from './format-musical-position';

describe('Transport BBT clock', () => {
  it('마디, 박자, tick을 고정 폭으로 표시한다', () => {
    expect(formatMusicalPosition({ bar: 12, beat: 3, tick: 48 })).toBe('012|03|0048');
  });
});
