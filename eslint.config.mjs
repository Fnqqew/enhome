// Reglas del código: TypeScript, hooks de React y nada de estilo (eso lo hace Prettier).

import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['node_modules', 'out', 'dist', 'build', 'resources', 'content'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Se usa a propósito tras validar con zod o leer de la base.
      '@typescript-eslint/no-non-null-assertion': 'off'
    }
  },
  {
    files: ['src/renderer/**/*.{js,ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    // Las funciones que se pasan a evaluate() corren dentro de la ventana.
    files: ['tests/e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.browser } }
  },
  {
    files: ['**/*.cjs'],
    rules: { '@typescript-eslint/no-require-imports': 'off' }
  }
)
