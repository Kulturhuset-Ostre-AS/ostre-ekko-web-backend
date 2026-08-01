import * as migration_20260701_203859_initial_schema from './20260701_203859_initial_schema';
import * as migration_20260723_120354_versions_drafts from './20260723_120354_versions_drafts';
import * as migration_20260731_155654_membership_commerce from './20260731_155654_membership_commerce';
import * as migration_20260731_205842_ticket_shop from './20260731_205842_ticket_shop';
import * as migration_20260801_100054_nav_menu_options from './20260801_100054_nav_menu_options';
import * as migration_20260801_212743_member_customer_link from './20260801_212743_member_customer_link';

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
    name: '20260731_205842_ticket_shop',
  },
  {
    up: migration_20260801_100054_nav_menu_options.up,
    down: migration_20260801_100054_nav_menu_options.down,
    name: '20260801_100054_nav_menu_options',
  },
  {
    up: migration_20260801_212743_member_customer_link.up,
    down: migration_20260801_212743_member_customer_link.down,
    name: '20260801_212743_member_customer_link'
  },
];
