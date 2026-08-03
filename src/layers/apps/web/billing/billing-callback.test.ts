import { describe, expect, it } from 'vitest';
import { readBillingActivationCallback, readBillingFailureCode } from './billing-callback';

describe('readBillingActivationCallback', () => {
  it('토스 성공 callback의 authKey와 customerKey를 읽는다', () => {
    expect(readBillingActivationCallback('?authKey=auth-key-1&customerKey=customer-key-1')).toEqual({
      authKey: 'auth-key-1',
      customerKey: 'customer-key-1',
    });
  });

  it('필수 값이 비었으면 callback을 거부한다', () => {
    expect(readBillingActivationCallback('?authKey=&customerKey=customer-key-1')).toBeNull();
    expect(readBillingActivationCallback('?authKey=auth-key-1')).toBeNull();
  });
});

describe('readBillingFailureCode', () => {
  it('화면에 표시 가능한 짧은 오류 코드만 반환한다', () => {
    expect(readBillingFailureCode('?code=USER_CANCEL')).toBe('USER_CANCEL');
    expect(readBillingFailureCode(`?code=${'A'.repeat(101)}`)).toBeNull();
    expect(readBillingFailureCode('?code=%3Cscript%3E')).toBeNull();
  });
});
