import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import vitest from 'eslint-plugin-vitest'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}'],
    plugins: {
      vitest,
    },
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'describe', property: 'only', message: 'Do not commit focused tests.' },
        { object: 'it', property: 'only', message: 'Do not commit focused tests.' },
        { object: 'test', property: 'only', message: 'Do not commit focused tests.' },
      ],
      'vitest/no-focused-tests': 'error',
      'vitest/valid-expect': 'error',
      'vitest/no-conditional-expect': 'warn',
    },
  },
])
