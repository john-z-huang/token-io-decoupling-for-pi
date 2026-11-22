import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import importX from 'eslint-plugin-import-x';
import prettier from 'eslint-plugin-prettier/recommended';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const codeFiles = '**/*.{js,ts,mjs}';
const codeLines = { skipBlankLines: true, skipComments: true };
const functionLength = ['error', { max: 50, IIFEs: true, ...codeLines }];
const identifierPattern = '^[A-Za-z_$][A-Za-z0-9_$]*$';
const typeAssertion = ':matches(TSAsExpression, TSTypeAssertion)';
const moduleSyntax = [
  {
    selector: 'ExportAllDeclaration[exported=null]',
    message: '请显式列出模块的公开导出。',
  },
  {
    selector: `${typeAssertion} > ${typeAssertion}.expression[typeAnnotation.type="TSUnknownKeyword"]`,
    message: '请验证或收窄输入类型，避免经 unknown 进行双重断言。',
  },
];

export default defineConfig(
  {
    files: [codeFiles],
    extends: [js.configs.recommended],
    linterOptions: { noInlineConfig: true },
    languageOptions: { globals: globals.nodeBuiltin },
    plugins: { 'import-x': importX },
    settings: {
      'import-x/extensions': ['.js', '.mjs', '.ts'],
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts'] },
    },
    rules: {
      'id-match': ['error', identifierPattern, { onlyDeclarations: true, classFields: true }],
      'import-x/no-cycle': ['error', { ignoreExternal: true }],
      'import-x/no-self-import': 'error',
      'no-else-return': ['error', { allowElseIf: true }],
      'no-lonely-if': 'error',
      'no-nested-ternary': 'error',
      'no-restricted-syntax': ['error', ...moduleSyntax],
    },
  },
  {
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: ['typeLike', 'method', 'classProperty', 'parameterProperty'],
          format: null,
          custom: { regex: identifierPattern, match: true },
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: [codeFiles],
    plugins: { sonarjs },
    rules: {
      'max-lines': ['error', { max: 300, ...codeLines }],
      'max-lines-per-function': functionLength,
      complexity: ['error', 10],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-depth': ['error', 3],
      'max-params': ['error', 3],
      'max-statements': ['error', 15],
      'max-nested-callbacks': ['error', 3],
    },
  },
  prettier,
);
