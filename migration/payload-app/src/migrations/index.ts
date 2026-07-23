import * as migration_20260701_203859_initial_schema from './20260701_203859_initial_schema';
import * as migration_20260723_120354_versions_drafts from './20260723_120354_versions_drafts';

export const migrations = [
  {
    up: migration_20260701_203859_initial_schema.up,
    down: migration_20260701_203859_initial_schema.down,
    name: '20260701_203859_initial_schema',
  },
  {
    up: migration_20260723_120354_versions_drafts.up,
    down: migration_20260723_120354_versions_drafts.down,
    name: '20260723_120354_versions_drafts'
  },
];
