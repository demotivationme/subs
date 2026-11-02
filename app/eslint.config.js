// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const i18next = require('eslint-plugin-i18next');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx', 'src/test/**'],
    plugins: { i18next },
    rules: { 'i18next/no-literal-string': ['error', { mode: 'jsx-only', 'jsx-attributes': { exclude: ['className', 'testID', 'style', 'name', 'key', 'id', 'href'] } }] },
  },
  { ignores: ['dist/*', '.expo/*'] },
]);
