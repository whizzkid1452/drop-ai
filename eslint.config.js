import js from '@eslint/js';
import ts from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';

export default ts.config([
  {
    ignores: ['AGENTS/**', 'coverage/**', 'dist/**', 'worktrees/**'],
  },
  js.configs.recommended,
  // TypeScript flat config는 배열이므로 펼쳐야 권장 규칙이 실제 파일에 적용된다.
  ...ts.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
      globals: { ...globals.browser, React: 'readonly' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': refresh,
      prettier,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-refresh/only-export-components': 'warn',
      'prettier/prettier': 'error',
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
  },
]);
