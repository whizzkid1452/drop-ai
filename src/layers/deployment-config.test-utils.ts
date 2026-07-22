import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function readRepositoryFile(filePath: string): string {
  return readFileSync(path.join(repositoryRoot, filePath), 'utf8');
}

export function extractBlock(sourceText: string, marker: string): string {
  const markerIndex = sourceText.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`설정 블록을 찾을 수 없습니다: ${marker}`);
  }

  const openingBraceIndex = sourceText.indexOf('{', markerIndex);
  let depth = 1;

  for (let index = openingBraceIndex + 1; index < sourceText.length; index += 1) {
    const character = sourceText[index];
    if (character === '{') {
      depth += 1;
    }
    if (character === '}') {
      depth -= 1;
    }
    if (depth === 0) {
      return sourceText.slice(openingBraceIndex + 1, index);
    }
  }

  throw new Error(`설정 블록이 닫히지 않았습니다: ${marker}`);
}

export function getDirectLines(blockText: string): string[] {
  let depth = 0;
  const directLines: string[] = [];

  for (const line of blockText.split(/\r?\n/)) {
    const lineWithoutComment = line.split('#', 1)[0];
    if (depth === 0 && lineWithoutComment.trim()) {
      directLines.push(lineWithoutComment.trim());
    }

    depth += (lineWithoutComment.match(/{/g) ?? []).length;
    depth -= (lineWithoutComment.match(/}/g) ?? []).length;
  }

  return directLines;
}
