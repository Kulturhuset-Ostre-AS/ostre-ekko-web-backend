import * as migration_20260701_203859_initial_schema from './20260701_203859_initial_schema';

export const migrations = [
  {
    up: migration_20260701_203859_initial_schema.up,
    down: migration_20260701_203859_initial_schema.down,
    name: '20260701_203859_initial_schema'
  },
];
