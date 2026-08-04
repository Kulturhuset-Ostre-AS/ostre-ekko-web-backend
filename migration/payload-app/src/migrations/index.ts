import * as migration_20260701_203859_initial_schema from './20260701_203859_initial_schema';
import * as migration_20260723_120354_versions_drafts from './20260723_120354_versions_drafts';
import * as migration_20260731_155654_membership_commerce from './20260731_155654_membership_commerce';
import * as migration_20260731_205842_ticket_shop from './20260731_205842_ticket_shop';
import * as migration_20260801_100054_nav_menu_options from './20260801_100054_nav_menu_options';
import * as migration_20260801_212743_member_customer_link from './20260801_212743_member_customer_link';
import * as migration_20260802_120000_localize_richtext from './20260802_120000_localize_richtext';
import * as migration_20260803_090000_miro_event_info from './20260803_090000_miro_event_info';
import * as migration_20260804_150000_categories_split from './20260804_150000_categories_split';
import * as migration_20260804_170000_receipt_numbers from './20260804_170000_receipt_numbers';
import * as migration_20260804_190000_customer_otp from './20260804_190000_customer_otp';

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
  {
    up: migration_20260802_120000_localize_richtext.up,
    down: migration_20260802_120000_localize_richtext.down,
    name: '20260802_120000_localize_richtext'
  },
  {
    up: migration_20260803_090000_miro_event_info.up,
    down: migration_20260803_090000_miro_event_info.down,
    name: '20260803_090000_miro_event_info'
  },
  {
    up: migration_20260804_150000_categories_split.up,
    down: migration_20260804_150000_categories_split.down,
    name: '20260804_150000_categories_split'
  },
  {
    up: migration_20260804_170000_receipt_numbers.up,
    down: migration_20260804_170000_receipt_numbers.down,
    name: '20260804_170000_receipt_numbers'
  },
  {
    up: migration_20260804_190000_customer_otp.up,
    down: migration_20260804_190000_customer_otp.down,
    name: '20260804_190000_customer_otp'
  },
];
