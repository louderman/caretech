// Jest setup: mock AsyncStorage with the official in-memory mock so core/sessionStore.ts and
// core/observationStore.ts can be unit-tested under plain Node/jsdom without a native module.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
