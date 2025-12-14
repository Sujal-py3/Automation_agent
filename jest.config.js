module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleFileExtensions: ['ts', 'js', 'json'],
    rootDir: './',
    testMatch: ['**/*.spec.ts'],
    transform: {
      '^.+\\.(ts|tsx)$': 'ts-jest',
    },
  };
  