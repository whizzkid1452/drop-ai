import { describe, expect, it } from 'vitest';
import { extractBlock, getDirectLines, readRepositoryFile } from './deployment-config.test-utils';

const expectedScriptSources = [
  "'self'",
  'http:',
  'https:',
  'data:',
  'blob:',
  "'unsafe-inline'",
  "'wasm-unsafe-eval'",
].sort();

function readNginxScriptSources(): string[] {
  const nginxConfig = readRepositoryFile('nginx.conf');
  const serverLines = getDirectLines(extractBlock(nginxConfig, 'server {'));
  const contentSecurityPolicyLines = serverLines.filter(line =>
    line.toLowerCase().startsWith('add_header content-security-policy')
  );

  if (contentSecurityPolicyLines.length !== 1) {
    throw new Error('nginx server 블록에는 Content-Security-Policy가 정확히 하나 있어야 합니다.');
  }

  const policyValue = contentSecurityPolicyLines[0].match(/Content-Security-Policy "([^"]+)"/i)?.[1];
  const scriptSourceDirective = policyValue
    ?.split(';')
    .map(directive => directive.trim())
    .find(directive => directive.toLowerCase().startsWith('script-src '));

  if (!scriptSourceDirective) {
    throw new Error('nginx script-src 설정을 찾을 수 없습니다.');
  }

  return scriptSourceDirective
    .split(/\s+/)
    .slice(1)
    .map(source => source.toLowerCase())
    .sort();
}

describe('nginx WebAssembly Content Security Policy', () => {
  it('기존 출처와 WebAssembly 전용 실행 권한만 허용한다', () => {
    const scriptSources = readNginxScriptSources();

    expect(scriptSources).toEqual(expectedScriptSources);
  });
});
