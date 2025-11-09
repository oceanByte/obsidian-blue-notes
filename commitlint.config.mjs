export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      [
        'chat',
        'search',
        'embeddings',
        'settings',
        'ui',
        'workflow',
        'deps',
        'docs',
        'core'
      ],
    ],
    'scope-empty': [2, 'never'],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'subject-case': [2, 'always', 'sentence-case'],
  },
};
