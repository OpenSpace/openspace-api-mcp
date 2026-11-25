import { tsLint } from '@openspace/shared-configs/eslint';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'eslint.config.js']
  },
  {
    files: ['src/**/*.ts'],
    extends: [tsLint],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      // A promise whose result or error is never handled hides failures
      '@typescript-eslint/no-floating-promises': 'error',
      // For example an async function passed where a callback has to return nothing
      '@typescript-eslint/no-misused-promises': 'error',
      // Arguments that are required by a signature but not used start with `_`
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  }
);
