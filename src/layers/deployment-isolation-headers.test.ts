import { describe, expect, it } from 'vitest';
import viteConfig from '../../vite.config';
import { extractBlock, getDirectLines, readRepositoryFile } from './deployment-config.test-utils';

const isolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
const nginxIsolationHeaderLines = [
  'add_header Cross-Origin-Embedder-Policy "require-corp" always;',
  'add_header Cross-Origin-Opener-Policy "same-origin" always;',
];

function getNetlifyHeaderLines(sourceText: string, pathPattern: string): string[] {
  const lines = sourceText.split(/\r?\n/);
  const pathIndex = lines.findIndex(line => line.trim() === pathPattern);
  if (pathIndex === -1) {
    throw new Error(`Netlify 경로 블록을 찾을 수 없습니다: ${pathPattern}`);
  }

  const headerLines: string[] = [];
  for (const line of lines.slice(pathIndex + 1)) {
    if (!line.trim() || !/^\s+/.test(line)) {
      break;
    }

    headerLines.push(line.trim());
  }

  return headerLines;
}

describe('Cross-Origin Isolation 배포 헤더', () => {
  it('Vite 개발 서버와 Preview 서버에 같은 헤더를 설정한다', () => {
    expect(viteConfig.server?.headers).toMatchObject(isolationHeaders);
    expect(viteConfig.preview?.headers).toMatchObject(isolationHeaders);
  });

  it('Netlify 전체 경로에 같은 헤더를 설정한다', () => {
    const netlifyHeaders = readRepositoryFile('public/_headers');
    const headerLines = getNetlifyHeaderLines(netlifyHeaders, '/*');

    expect(headerLines).toEqual(
      expect.arrayContaining(['Cross-Origin-Opener-Policy: same-origin', 'Cross-Origin-Embedder-Policy: require-corp'])
    );
  });

  it('nginx server 응답에 실패 상태를 포함한 헤더를 설정한다', () => {
    const nginxConfig = readRepositoryFile('nginx.conf');
    const serverLines = getDirectLines(extractBlock(nginxConfig, 'server {'));

    expect(serverLines).toEqual(expect.arrayContaining(nginxIsolationHeaderLines));
  });

  it('nginx 정적 파일 응답에도 헤더를 직접 설정한다', () => {
    const nginxConfig = readRepositoryFile('nginx.conf');
    const staticLocationMarker = 'location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {';
    const staticLocationLines = getDirectLines(extractBlock(nginxConfig, staticLocationMarker));

    expect(staticLocationLines).toEqual(expect.arrayContaining(nginxIsolationHeaderLines));
  });
});
