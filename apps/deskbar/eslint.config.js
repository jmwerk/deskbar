import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // scripts/{bridgething,push,share}.ts are generated verbatim from @bridgething/webapp-shared; don't lint them.
  { ignores: ['dist', 'node_modules', 'scripts/bridgething.ts', 'scripts/push.ts', 'scripts/share.ts'] },
  {
    files: ['src/**/*.{ts,tsx}', 'settings/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Hand-picked, not react-hooks' recommended-latest; targets React Compiler, doesn't apply here.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['*.config.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
  },
);
