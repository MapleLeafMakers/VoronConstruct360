module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'airbnb',
    'plugin:react/recommended',
  ],
  overrides: [
    {
      env: {
        node: true,
      },
      files: [
        '.eslintrc.{js,cjs}',
      ],
      parserOptions: {
        sourceType: 'script',
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: [
  ],
  rules: {
    'jsx-a11y/click-events-have-key-events': 'warn',
    'jsx-a11y/label-has-associated-control': 'warn',
    'jsx-a11y/no-static-element-interactions': 'off',
  },
};
