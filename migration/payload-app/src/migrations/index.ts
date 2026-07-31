import * as migration_20260701_203859_initial_schema from './20260701_203859_initial_schema';
import * as migration_20260723_120354_versions_drafts from './20260723_120354_versions_drafts';
import * as migration_20260731_155654_membership_commerce from './20260731_155654_membership_commerce';
import * as migration_20260731_205842_ticket_shop from './20260731_205842_ticket_shop';

export const migrations = [
  {
    up: migration_20260701_203859_initial_schema.up,
    down: migration_20260701_203859_initial_schema.down,
    name: '20260701_203859_initial_schema',
  },
  {
    up: migration_20260723_120354_versions_drafts.up,
    down: migration_20260723_120354_versions_drafts.down,
    name: '20260723_120354_versions_drafts',
  },
  {
    up: migration_20260731_155654_membership_commerce.up,
    down: migration_20260731_155654_membership_commerce.down,
    name: '20260731_155654_membership_commerce',
  },
  {
    up: migration_20260731_205842_ticket_shop.up,
    down: migration_20260731_205842_ticket_shop.down,
    name: '20260731_205842_ticket_shop'
  },
];
