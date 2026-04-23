# MySQL export (mysqldump) for Craft / hosting

Use this when pulling a database from the **server where MySQL runs** (the app’s `DB_SERVER=localhost` means **that host**, not your laptop).

## One-shot export (recommended defaults)

```bash
cd /path/to/cms   # directory that contains .env

set -a
source .env
set +a

mysqldump \
  --no-tablespaces \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  -h "$DB_SERVER" \
  -P "$DB_PORT" \
  -u "$DB_USER" \
  -p \
  "$DB_DATABASE" | gzip -9 > "ekko-$(date +%Y%m%d).sql.gz"
```

Enter the password at the prompt (avoids shell history and quoting bugs).

### Why `--no-tablespaces`

Shared / limited DB users often lack the **`PROCESS`** privilege. Without `--no-tablespaces`, `mysqldump` can fail with:

`Access denied; you need (at least one of) the PROCESS privilege(s) for this operation when trying to dump tablespaces`

For normal Craft restores, **tablespace metadata is not required**; `--no-tablespaces` is correct.

### If `localhost` auth is flaky

Force TCP to the same machine:

```bash
mysqldump \
  --no-tablespaces \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  --protocol=TCP \
  -h 127.0.0.1 \
  -P "${DB_PORT:-3306}" \
  -u "$DB_USER" \
  -p \
  "$DB_DATABASE" | gzip -9 > "ekko-$(date +%Y%m%d).sql.gz"
```

### If the password has awkward characters (`$`, backticks, etc.)

Do **not** rely on `-p"$DB_PASSWORD"` on the shell. Prefer **`-p` (prompt)** or a **defaults file**:

```bash
cat > /tmp/ekko-mysql.cnf <<'EOF'
[client]
host=127.0.0.1
port=3306
user=YOUR_USER
password=YOUR_PASSWORD
EOF
chmod 600 /tmp/ekko-mysql.cnf

mysqldump \
  --defaults-extra-file=/tmp/ekko-mysql.cnf \
  --no-tablespaces \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  YOUR_DATABASE | gzip -9 > "ekko-$(date +%Y%m%d).sql.gz"

rm /tmp/ekko-mysql.cnf
```

### `.env` and `source`

If you use `source .env` in **bash**, double-quoted values containing **`$`** can be **expanded by the shell** and corrupt `DB_PASSWORD`. Prefer single-quoted passwords in `.env`, or use a prompt / defaults file for the dump.

## “Delta” / follow-up exports

`mysqldump` does **not** emit a built-in incremental diff. Practical options:

1. **Second full dump** before cutover — simplest and safest; compare file size/checksums if needed.
2. **Table-scoped dump** after a known change window — e.g. only hot tables (larger maintenance, must be consistent with your restore plan).
3. **Row filter (advanced)** — e.g. `--where="dateUpdated > 'YYYY-MM-DD HH:MM:SS'"` on specific tables that have a suitable column; **not** a complete substitute for a full backup and easy to get wrong with Craft’s relational data.

For a **final clone** before DNS switch, run the **full** command again with the same flags; keep the last `.sql.gz` as the canonical snapshot.

## Restore (reference)

```bash
gunzip -c ekko-YYYYMMDD.sql.gz | mysql -h HOST -P 3306 -u USER -p DATABASE
```

Use Cloud SQL Auth Proxy or VPC rules as required by your target environment.
