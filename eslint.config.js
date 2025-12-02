import js from '@eslint/js';
import ts from 'typescript-eslint';
import react from 'eslint-plugin-react';
import refresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';

export default ts.config([
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: ts.parser,
      parserOptions: { ecmaVersion: 2023, sourceType: 'module' },
      globals: { ...globals.browser, React: 'readonly' },
    },
    plugins: { '@typescript-eslint': ts.plugin, react, refresh, prettier },
    rules: {
      ...ts.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react-refresh/only-export-components': 'warn',
      'prettier/prettier': 'error',
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
