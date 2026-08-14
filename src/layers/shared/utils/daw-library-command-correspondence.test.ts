import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { AudioCommandType } from '../types/audioCommand.schema';
import { AUDIO_COMMAND_FEATURE_REQUIREMENT } from './audio-command-feature-map';
import { DAW_LIBRARY_COMMAND_CORRESPONDENCE } from './daw-library-command-correspondence';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const libraryCommandTypePath = path.join(repositoryRoot, 'daw-engine/core/src/commands/types.ts');

function readLibraryCommandTypes(): string[] {
  const source = readFileSync(libraryCommandTypePath, 'utf8');
  const commandTypeBlock = source.match(/export const CommandType = \{([\s\S]*?)\} as const;/);
  if (!commandTypeBlock) {
    throw new Error('daw-engine CommandType 선언을 찾지 못했습니다.');
  }

  return [...commandTypeBlock[1].matchAll(/^\s+([A-Z][A-Z0-9_]+):/gm)].map(match => match[1]);
}

describe('DAW 라이브러리 명령 대응표', () => {
  it('라이브러리 공개 명령마다 대응 상태를 가진다', () => {
    const libraryCommandTypes = readLibraryCommandTypes();
    const correspondenceKeys = Object.keys(DAW_LIBRARY_COMMAND_CORRESPONDENCE);

    expect(correspondenceKeys.sort()).toEqual([...libraryCommandTypes].sort());
  });

  it('대응 상태는 available, blocked, unsupported, internal만 허용한다', () => {
    const allowedStatuses = new Set(['available', 'blocked', 'unsupported', 'internal']);

    Object.values(DAW_LIBRARY_COMMAND_CORRESPONDENCE).forEach(entry => {
      expect(allowedStatuses.has(entry.status)).toBe(true);
    });
  });

  it('연결된 제품 명령은 실제 AudioCommandType이다', () => {
    const productCommandTypes = new Set<string>(Object.values(AudioCommandType));

    Object.values(DAW_LIBRARY_COMMAND_CORRESPONDENCE).forEach(entry => {
      entry.productCommands.forEach(productCommand => {
        expect(productCommandTypes.has(productCommand)).toBe(true);
      });
    });
  });

  it('미지원 명령은 제품 명령을 연결하지 않는다', () => {
    Object.values(DAW_LIBRARY_COMMAND_CORRESPONDENCE).forEach(entry => {
      if (entry.status === 'unsupported' || entry.status === 'internal') {
        expect(entry.productCommands).toEqual([]);
      }
    });
  });
});

describe('제품 AudioCommand 기능 요구', () => {
  it('모든 제품 명령의 기능 요구가 정의되어 있다', () => {
    expect(Object.keys(AUDIO_COMMAND_FEATURE_REQUIREMENT).sort()).toEqual(
      Object.values(AudioCommandType).slice().sort()
    );
  });
});
