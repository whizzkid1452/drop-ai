import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface SourceImport {
  importerPath: string;
  moduleName: string;
  resolvedPath?: string;
}

const layersRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.dirname(layersRoot);
const repositoryRoot = path.dirname(sourceRoot);
const appsRoot = path.join(layersRoot, 'apps');
const audioEngineRoot = path.join(layersRoot, 'audio-engine');
const audioSourceRepositoryRoot = path.join(layersRoot, 'audio-source-repository');
const audioSourceRegistryRoot = path.join(layersRoot, 'audio-source-registry');
const controllersRoot = path.join(layersRoot, 'controllers');
const commandRoot = path.join(layersRoot, 'commands');
const pluginHostRoot = path.join(layersRoot, 'plugin-host');
const projectCrdtRoot = path.join(layersRoot, 'project-crdt');
const projectDocumentMapperRoot = path.join(layersRoot, 'project-document-mapper');
const queriesRoot = path.join(layersRoot, 'queries');
const projectRepositoryRoot = path.join(layersRoot, 'project-repository');
const pluginSdkRoot = path.join(layersRoot, 'plugin-sdk');
const pluginsRoot = path.join(layersRoot, 'plugins');
const sessionRoot = path.join(layersRoot, 'session');
const sharedRoot = path.join(layersRoot, 'shared');
const compositionRootPath = path.join(appsRoot, 'create-app.ts');
const audioSourceRepositoryPublicContractPaths = new Set([
  path.join(audioSourceRepositoryRoot, 'errors'),
  path.join(audioSourceRepositoryRoot, 'i-audio-source-repository'),
]);
const audioSourceRegistryPublicContractPaths = new Set([
  path.join(audioSourceRegistryRoot, 'errors'),
  path.join(audioSourceRegistryRoot, 'i-audio-source-registry'),
]);
const audioEnginePublicContractPaths = new Set([
  path.join(audioEngineRoot, 'errors'),
  path.join(audioEngineRoot, 'i-audio-engine'),
]);
const projectRepositoryPublicContractPaths = new Set([
  path.join(projectRepositoryRoot, 'errors'),
  path.join(projectRepositoryRoot, 'i-project-repository'),
]);
const pluginHostPublicContractPaths = new Set([
  path.join(pluginHostRoot, 'errors'),
  path.join(pluginHostRoot, 'i-plugin-host'),
]);
const webAudioConstructorNames = new Set([
  'AnalyserNode',
  'AudioBuffer',
  'AudioBufferSourceNode',
  'AudioContext',
  'AudioWorkletNode',
  'BiquadFilterNode',
  'ChannelMergerNode',
  'ChannelSplitterNode',
  'ConstantSourceNode',
  'ConvolverNode',
  'DelayNode',
  'DynamicsCompressorNode',
  'GainNode',
  'IIRFilterNode',
  'MediaElementAudioSourceNode',
  'MediaStreamAudioDestinationNode',
  'MediaStreamAudioSourceNode',
  'MediaStreamTrackAudioSourceNode',
  'OfflineAudioContext',
  'OscillatorNode',
  'PannerNode',
  'PeriodicWave',
  'StereoPannerNode',
  'WaveShaperNode',
  'webkitAudioContext',
]);
const webAudioFactoryMethodNames = new Set([
  'createAnalyser',
  'createBiquadFilter',
  'createBufferSource',
  'createChannelMerger',
  'createChannelSplitter',
  'createConstantSource',
  'createConvolver',
  'createDelay',
  'createDynamicsCompressor',
  'createGain',
  'createIIRFilter',
  'createMediaElementSource',
  'createMediaStreamDestination',
  'createMediaStreamSource',
  'createMediaStreamTrackSource',
  'createOscillator',
  'createPanner',
  'createPeriodicWave',
  'createScriptProcessor',
  'createStereoPanner',
  'createWaveShaper',
]);
const tsconfigPath = path.join(repositoryRoot, 'tsconfig.app.json');
const tsconfig = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

if (tsconfig.error) {
  throw new Error(ts.flattenDiagnosticMessageText(tsconfig.error.messageText, '\n'));
}

const compilerOptions = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, repositoryRoot).options;
const moduleResolutionCache = ts.createModuleResolutionCache(repositoryRoot, fileName => fileName, compilerOptions);

function listSourceFiles(directoryPath: string): string[] {
  return readdirSync(directoryPath, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(entryPath);
    }

    if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) {
      return [];
    }

    return [entryPath];
  });
}

function isTestFile(filePath: string): boolean {
  return /\.(?:spec|test)\.tsx?$/.test(filePath);
}

function resolveLocalModule(importerPath: string, moduleName: string): string | undefined {
  return ts.resolveModuleName(moduleName, importerPath, compilerOptions, ts.sys, moduleResolutionCache).resolvedModule
    ?.resolvedFileName;
}

function collectModuleNames(sourceText: string, filePath: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const moduleNames: string[] = [];

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      moduleNames.push(node.moduleSpecifier.text);
    }

    if (ts.isCallExpression(node)) {
      const firstArgument = node.arguments[0];
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequireCall =
        ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments.length === 1;

      if (firstArgument && ts.isStringLiteral(firstArgument) && (isDynamicImport || isRequireCall)) {
        moduleNames.push(firstArgument.text);
      }
    }

    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      moduleNames.push(node.argument.literal.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return moduleNames;
}

function getAccessedName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }

  if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    return ts.isStringLiteral(expression.argumentExpression) ? expression.argumentExpression.text : undefined;
  }

  return undefined;
}

function isTypePosition(node: ts.Node): boolean {
  let currentNode: ts.Node | undefined = node.parent;

  while (currentNode) {
    if (ts.isTypeNode(currentNode)) {
      return true;
    }

    if (ts.isStatement(currentNode) || ts.isExpression(currentNode)) {
      return false;
    }

    currentNode = currentNode.parent;
  }

  return false;
}

function isDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent;
  return 'name' in parent && parent.name === node && !ts.isPropertyAccessExpression(parent);
}

function collectDirectWebAudioUsages(sourceText: string, filePath: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const usages: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isNewExpression(node)) {
      const constructorName = getAccessedName(node.expression);

      if (constructorName && webAudioConstructorNames.has(constructorName)) {
        usages.push(`new ${constructorName}`);
      }
    }

    if (ts.isCallExpression(node)) {
      const methodName = getAccessedName(node.expression);
      if (methodName && webAudioFactoryMethodNames.has(methodName)) {
        usages.push(`${methodName}()`);
      }
    }

    if (
      (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
      !ts.isNewExpression(node.parent)
    ) {
      const accessedName = getAccessedName(node);
      if (accessedName && webAudioConstructorNames.has(accessedName)) {
        usages.push(accessedName);
      }
    }

    if (
      ts.isIdentifier(node) &&
      webAudioConstructorNames.has(node.text) &&
      !ts.isNewExpression(node.parent) &&
      !ts.isPropertyAccessExpression(node.parent) &&
      !isDeclarationName(node) &&
      !isTypePosition(node)
    ) {
      usages.push(node.text);
    }

    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression &&
      ts.isStringLiteral(node.argumentExpression) &&
      webAudioConstructorNames.has(node.argumentExpression.text) &&
      !ts.isNewExpression(node.parent)
    ) {
      const usage = node.argumentExpression.text;
      if (!usages.includes(usage)) {
        usages.push(usage);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return usages;
}

function collectSourceImports(): SourceImport[] {
  return listSourceFiles(sourceRoot).flatMap(importerPath => {
    const sourceText = readFileSync(importerPath, 'utf8');
    return collectModuleNames(sourceText, importerPath).map(moduleName => ({
      importerPath,
      moduleName,
      resolvedPath: resolveLocalModule(importerPath, moduleName),
    }));
  });
}

function isAppSource(filePath: string | undefined): boolean {
  if (!filePath) {
    return false;
  }

  return isInside(filePath, appsRoot) || (isInside(filePath, sourceRoot) && !isInside(filePath, layersRoot));
}

function isInside(filePath: string | undefined, directoryPath: string): boolean {
  if (!filePath) {
    return false;
  }

  const relativePath = path.relative(directoryPath, filePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function removeSourceExtension(filePath: string | undefined): string | undefined {
  return filePath ? path.normalize(filePath).replace(/\.(?:tsx?|jsx?)$/, '') : undefined;
}

function formatViolations(imports: SourceImport[]): string[] {
  return imports.map(sourceImport => {
    const importerPath = path.relative(sourceRoot, sourceImport.importerPath).replaceAll('\\', '/');
    return `${importerPath} -> ${sourceImport.moduleName}`;
  });
}

const sourceImports = collectSourceImports();

describe('레이어 의존성 규칙', () => {
  it('Apps는 Composition Root 밖에서 Controller를 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        isAppSource(sourceImport.importerPath) &&
        sourceImport.importerPath !== compositionRootPath &&
        !isTestFile(sourceImport.importerPath) &&
        isInside(sourceImport.resolvedPath, controllersRoot)
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('src 루트 파일을 Apps로 분류한다', () => {
    expect(isAppSource(path.join(sourceRoot, 'App.tsx'))).toBe(true);
    expect(isAppSource(path.join(sourceRoot, 'main.tsx'))).toBe(true);
  });

  it('옵션이 있는 동적 import도 수집한다', () => {
    const sourceText = "import('../controllers/app-controller', { with: { type: 'json' } });";

    expect(collectModuleNames(sourceText, 'fixture.ts')).toEqual(['../controllers/app-controller']);
  });

  it('AudioEngine 모듈은 허용된 계층에서만 import한다', () => {
    const violations = sourceImports.filter(sourceImport => {
      const resolvedPath = removeSourceExtension(sourceImport.resolvedPath);
      if (
        !resolvedPath ||
        !isInside(resolvedPath, audioEngineRoot) ||
        isInside(sourceImport.importerPath, audioEngineRoot)
      ) {
        return false;
      }

      if (sourceImport.importerPath === compositionRootPath || isTestFile(sourceImport.importerPath)) {
        return false;
      }

      if (isInside(sourceImport.importerPath, controllersRoot)) {
        return !audioEnginePublicContractPaths.has(resolvedPath);
      }

      if (isAppSource(sourceImport.importerPath)) {
        return resolvedPath !== path.join(audioEngineRoot, 'errors');
      }

      return true;
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Commands와 Queries는 AudioEngine 계층을 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      if (isTestFile(sourceImport.importerPath)) {
        return false;
      }

      const isRestrictedLayer =
        isInside(sourceImport.importerPath, commandRoot) || isInside(sourceImport.importerPath, queriesRoot);
      return isRestrictedLayer && isInside(sourceImport.resolvedPath, audioEngineRoot);
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Commands는 Apps와 Queries를 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        !isTestFile(sourceImport.importerPath) &&
        isInside(sourceImport.importerPath, commandRoot) &&
        (isAppSource(sourceImport.resolvedPath) || isInside(sourceImport.resolvedPath, queriesRoot))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Controllers는 Apps, Commands, Queries를 import하지 않는다', () => {
    const forbiddenRoots = [commandRoot, queriesRoot];
    const violations = sourceImports.filter(sourceImport => {
      return (
        !isTestFile(sourceImport.importerPath) &&
        isInside(sourceImport.importerPath, controllersRoot) &&
        (isAppSource(sourceImport.resolvedPath) ||
          forbiddenRoots.some(directoryPath => isInside(sourceImport.resolvedPath, directoryPath)))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Queries는 상위 계층과 상태·AudioEngine 구현을 import하지 않는다', () => {
    const forbiddenRoots = [commandRoot, controllersRoot, sessionRoot, audioEngineRoot];
    const violations = sourceImports.filter(sourceImport => {
      return (
        !isTestFile(sourceImport.importerPath) &&
        isInside(sourceImport.importerPath, queriesRoot) &&
        (isAppSource(sourceImport.resolvedPath) ||
          forbiddenRoots.some(directoryPath => isInside(sourceImport.resolvedPath, directoryPath)))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('AudioEngine은 상위 계층을 import하지 않는다', () => {
    const upperLayerRoots = [commandRoot, controllersRoot, queriesRoot, sessionRoot];
    const violations = sourceImports.filter(sourceImport => {
      return (
        isInside(sourceImport.importerPath, audioEngineRoot) &&
        (isAppSource(sourceImport.resolvedPath) ||
          upperLayerRoots.some(directoryPath => isInside(sourceImport.resolvedPath, directoryPath)))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Session은 상위 계층과 AudioEngine을 import하지 않는다', () => {
    const forbiddenRoots = [commandRoot, controllersRoot, projectDocumentMapperRoot, queriesRoot, audioEngineRoot];
    const violations = sourceImports.filter(sourceImport => {
      return (
        isInside(sourceImport.importerPath, sessionRoot) &&
        (isAppSource(sourceImport.resolvedPath) ||
          forbiddenRoots.some(directoryPath => isInside(sourceImport.resolvedPath, directoryPath)))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('ProjectDocumentMapper는 Session과 Shared 외 다른 계층을 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        isInside(sourceImport.importerPath, projectDocumentMapperRoot) &&
        !isTestFile(sourceImport.importerPath) &&
        sourceImport.resolvedPath !== undefined &&
        (isAppSource(sourceImport.resolvedPath) ||
          (isInside(sourceImport.resolvedPath, layersRoot) &&
            !isInside(sourceImport.resolvedPath, projectDocumentMapperRoot) &&
            !isInside(sourceImport.resolvedPath, sessionRoot) &&
            !isInside(sourceImport.resolvedPath, sharedRoot)))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('ProjectDocumentMapper는 Controllers 밖의 production 계층에서 직접 사용하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        !isTestFile(sourceImport.importerPath) &&
        !isInside(sourceImport.importerPath, projectDocumentMapperRoot) &&
        isInside(sourceImport.resolvedPath, projectDocumentMapperRoot) &&
        !isInside(sourceImport.importerPath, controllersRoot)
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('ProjectRepository는 Shared와 ProjectCrdt 외 다른 계층을 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        isInside(sourceImport.importerPath, projectRepositoryRoot) &&
        !isTestFile(sourceImport.importerPath) &&
        sourceImport.resolvedPath !== undefined &&
        isInside(sourceImport.resolvedPath, layersRoot) &&
        !isInside(sourceImport.resolvedPath, projectRepositoryRoot) &&
        !isInside(sourceImport.resolvedPath, projectCrdtRoot) &&
        !isInside(sourceImport.resolvedPath, sharedRoot)
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('ProjectRepository 외부 소비자는 공개 계약만 import한다', () => {
    const violations = sourceImports.filter(sourceImport => {
      const resolvedPath = removeSourceExtension(sourceImport.resolvedPath);
      if (
        !resolvedPath ||
        !isInside(resolvedPath, projectRepositoryRoot) ||
        isInside(sourceImport.importerPath, projectRepositoryRoot)
      ) {
        return false;
      }

      return (
        !isTestFile(sourceImport.importerPath) &&
        sourceImport.importerPath !== compositionRootPath &&
        !projectRepositoryPublicContractPaths.has(resolvedPath)
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('AudioSourceRegistry는 Shared 외 다른 계층을 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        isInside(sourceImport.importerPath, audioSourceRegistryRoot) &&
        !isTestFile(sourceImport.importerPath) &&
        sourceImport.resolvedPath !== undefined &&
        (isAppSource(sourceImport.resolvedPath) ||
          (isInside(sourceImport.resolvedPath, layersRoot) &&
            !isInside(sourceImport.resolvedPath, audioSourceRegistryRoot) &&
            !isInside(sourceImport.resolvedPath, sharedRoot)))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('AudioSourceRepository는 Shared 외 다른 계층을 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        isInside(sourceImport.importerPath, audioSourceRepositoryRoot) &&
        !isTestFile(sourceImport.importerPath) &&
        sourceImport.resolvedPath !== undefined &&
        (isAppSource(sourceImport.resolvedPath) ||
          (isInside(sourceImport.resolvedPath, layersRoot) &&
            !isInside(sourceImport.resolvedPath, audioSourceRepositoryRoot) &&
            !isInside(sourceImport.resolvedPath, sharedRoot)))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('AudioSourceRepository 외부 소비자는 공개 계약만 import한다', () => {
    const violations = sourceImports.filter(sourceImport => {
      const resolvedPath = removeSourceExtension(sourceImport.resolvedPath);
      if (
        !resolvedPath ||
        !isInside(resolvedPath, audioSourceRepositoryRoot) ||
        isInside(sourceImport.importerPath, audioSourceRepositoryRoot)
      ) {
        return false;
      }

      return (
        !isTestFile(sourceImport.importerPath) &&
        sourceImport.importerPath !== compositionRootPath &&
        !audioSourceRepositoryPublicContractPaths.has(resolvedPath)
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Audio Source 외부 소비자는 공개 계약만 import한다', () => {
    const violations = sourceImports.filter(sourceImport => {
      const resolvedPath = removeSourceExtension(sourceImport.resolvedPath);
      if (
        !resolvedPath ||
        !isInside(resolvedPath, audioSourceRegistryRoot) ||
        isInside(sourceImport.importerPath, audioSourceRegistryRoot)
      ) {
        return false;
      }

      return (
        !isTestFile(sourceImport.importerPath) &&
        sourceImport.importerPath !== compositionRootPath &&
        !audioSourceRegistryPublicContractPaths.has(resolvedPath)
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Shared는 다른 계층을 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        isInside(sourceImport.importerPath, sharedRoot) &&
        sourceImport.resolvedPath !== undefined &&
        ((isInside(sourceImport.resolvedPath, layersRoot) && !isInside(sourceImport.resolvedPath, sharedRoot)) ||
          isAppSource(sourceImport.resolvedPath))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Plugin SDK는 다른 계층을 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        isInside(sourceImport.importerPath, pluginSdkRoot) &&
        sourceImport.resolvedPath !== undefined &&
        ((isInside(sourceImport.resolvedPath, layersRoot) && !isInside(sourceImport.resolvedPath, pluginSdkRoot)) ||
          isAppSource(sourceImport.resolvedPath))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('PluginHost는 Plugin SDK와 Shared 외 다른 계층을 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        isInside(sourceImport.importerPath, pluginHostRoot) &&
        !isTestFile(sourceImport.importerPath) &&
        sourceImport.resolvedPath !== undefined &&
        (isAppSource(sourceImport.resolvedPath) ||
          (isInside(sourceImport.resolvedPath, layersRoot) &&
            !isInside(sourceImport.resolvedPath, pluginHostRoot) &&
            !isInside(sourceImport.resolvedPath, pluginSdkRoot) &&
            !isInside(sourceImport.resolvedPath, sharedRoot)))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('PluginHost 외부 소비자는 공개 계약만 import한다', () => {
    const violations = sourceImports.filter(sourceImport => {
      const resolvedPath = removeSourceExtension(sourceImport.resolvedPath);
      if (
        !resolvedPath ||
        !isInside(resolvedPath, pluginHostRoot) ||
        isInside(sourceImport.importerPath, pluginHostRoot)
      ) {
        return false;
      }

      if (isTestFile(sourceImport.importerPath) || sourceImport.importerPath === compositionRootPath) {
        return false;
      }

      return !isInside(sourceImport.importerPath, controllersRoot) || !pluginHostPublicContractPaths.has(resolvedPath);
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Plugin 구현은 Plugin SDK 외 다른 계층을 import하지 않는다', () => {
    const violations = sourceImports.filter(sourceImport => {
      return (
        isInside(sourceImport.importerPath, pluginsRoot) &&
        !isTestFile(sourceImport.importerPath) &&
        sourceImport.resolvedPath !== undefined &&
        (isAppSource(sourceImport.resolvedPath) ||
          (isInside(sourceImport.resolvedPath, layersRoot) &&
            !isInside(sourceImport.resolvedPath, pluginsRoot) &&
            !isInside(sourceImport.resolvedPath, pluginSdkRoot)))
      );
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Tone.js는 AudioEngine 계층에서만 import한다', () => {
    const violations = sourceImports.filter(sourceImport => {
      const importsTone = sourceImport.moduleName === 'tone' || sourceImport.moduleName.startsWith('tone/');
      return importsTone && !isInside(sourceImport.importerPath, audioEngineRoot);
    });

    expect(formatViolations(violations)).toEqual([]);
  });

  it('Web Audio 직접 접근 탐지가 생성자, 팩토리, 별칭 접근을 포함한다', () => {
    const sourceText = [
      'new AudioContext();',
      'new window.AudioWorkletNode();',
      'audioContext.createGain();',
      'gpuDevice.createBuffer();',
      "const Context = globalThis['OfflineAudioContext'];",
      'const OtherContext = AudioContext;',
    ].join('\n');

    expect(collectDirectWebAudioUsages(sourceText, 'fixture.ts')).toEqual([
      'new AudioContext',
      'new AudioWorkletNode',
      'createGain()',
      'OfflineAudioContext',
      'AudioContext',
    ]);
  });

  it('Web Audio 생성자와 팩토리는 AudioEngine 계층에서만 직접 사용한다', () => {
    const violations = listSourceFiles(sourceRoot).flatMap(importerPath => {
      if (isInside(importerPath, audioEngineRoot)) {
        return [];
      }

      const sourceText = readFileSync(importerPath, 'utf8');
      return collectDirectWebAudioUsages(sourceText, importerPath).map(usage => {
        const relativePath = path.relative(sourceRoot, importerPath).replaceAll('\\', '/');
        return `${relativePath} -> ${usage}`;
      });
    });

    expect(violations).toEqual([]);
  });
});
