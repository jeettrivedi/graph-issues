import js from '@eslint/js';
import * as tsParser from '@typescript-eslint/parser';
import * as tsPlugin from '@typescript-eslint/eslint-plugin';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        project: './tsconfig.json',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        __VERSION__: 'readonly',
        __GIT_HASH__: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-refresh': reactRefreshPlugin,
      'react-hooks': reactHooksPlugin,
      'prettier': prettierPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ],
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },
  prettierConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
];