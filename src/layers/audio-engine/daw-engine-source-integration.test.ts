import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
}

const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
const packageJsonPath = path.join(projectRoot, 'package.json');
const adapterPath = path.join(projectRoot, 'src/layers/audio-engine/daw-engine-adapter.ts');
const localEngineEntryPath = path.join(projectRoot, 'daw-engine/core/src/browser-adapter.ts');

describe('DAW Engine source integration', () => {
  it('로컬 DAW Engine 소스를 저장소에 포함한다', () => {
    expect(existsSync(localEngineEntryPath)).toBe(true);
  });

  it('외부 패키지 대신 로컬 소스 진입점을 사용한다', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
    const adapterSource = readFileSync(adapterPath, 'utf8');

    expect(packageJson.dependencies).not.toHaveProperty('@daw-engine/core');
    expect(adapterSource).toContain("from '@daw-engine-source/browser-adapter'");
  });
});
