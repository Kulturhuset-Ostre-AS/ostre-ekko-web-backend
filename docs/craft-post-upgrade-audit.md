# Craft CMS — post-upgrade audit notes

Internal notes from a **Craft 5 / headless** pass: things that were checked, fixed, or remain to watch. Pair with [GraphQL frontend migration](graphql-frontend-migration.md).

---

## Fixed in repo

| Item | Action |
|------|--------|
| **Dead Twig URL rule** | Removed `events/<festivalSlug>/<artistSlug>` → `artists/_entry_festival` from `cms/config/routes.php`. Templates under `cms/templates/` are gone; that route would 404 or error on site requests. |
| **GraphQL `sectionId` clash** | Custom Plain Text field renamed to **`sectionAnchorId`** (see GraphQL migration doc). |
| **`meta.__names__` for anchor field** | Restored `e2bb1603-…` label in `cms/config/project/project.yaml` so Project Config stays aligned with the field file. |

---

## Verified clean

| Check | Result |
|-------|--------|
| **Custom field handle ∩ native `EntryInterface` names** | No further collisions after `sectionAnchorId` rename (scripted compare against Craft’s interface definitions). |
| **`project-config/diff`** | No pending YAML changes after apply (run again after any hand-edited YAML). |

---

## Watch list (not blocking)

| Item | Detail |
|------|--------|
| **`composer audit`** | **google/protobuf** — advisory `CVE-2026-6409` (DoS via malicious messages); constraint pulled in via Google client libraries. Track upstream bumps (`composer update` when safe) or isolate Google-dependent code paths. |
| **Abandoned Composer packages** | Reported: `aelvan/mailchimp-subscribe`, `craftcms/redactor` (suggest **CKEditor**), `google/crc32`. Plan replacements on your own timeline. |
| **`cms/config/project__backup/`** | Old tree copy (includes pre-upgrade field types such as videoembedder). **Not** loaded by Craft; safe to delete locally or add to `.gitignore` if it should never ship. Do not confuse with `cms/config/project/`. |
| **`modules/ekkomodule`** | Still labelled “Craft 3.x” in headers; uses `artist[0]`-style access in helpers — fine for legacy Twig **if** you ever restore CP-only Twig; irrelevant to headless GraphQL. Refactor if you touch that code. |

---

## Optional checks after each deploy

```bash
docker compose --profile local-db exec -T php ./craft project-config/diff
docker compose --profile local-db exec -T php ./craft migrate/all --noBackup=1 --interactive=0
```

Resolve any diff before relying on production Project Config.
