#!/usr/bin/env bash
# Copies the app database (schemas public and drizzle) from the PostgreSQL 17
# Neon project to the PostgreSQL 18 one, then compares every table's row count
# and content hash. It replaces those schemas on the target, so run it only
# before DATABASE_URL points at the target. After the cutover the target is
# production and this script must not run again.
#
# Usage:
#   OLD_DATABASE_URL_DIRECT=... NEW_DATABASE_URL_DIRECT=... \
#   CONFIRM_OVERWRITE=<target host> scripts/copy-to-postgres-18.sh
#
# Both URLs must be direct (no -pooler). Needs PostgreSQL 18 client tools.
set -euo pipefail

: "${OLD_DATABASE_URL_DIRECT:?set to the PostgreSQL 17 direct URL}"
: "${NEW_DATABASE_URL_DIRECT:?set to the PostgreSQL 18 direct URL}"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/18/bin}"
export PGTZ=UTC

sql() { "$PG_BIN/psql" "$1" -X -q -v ON_ERROR_STOP=1 -At -c "$2"; }
host() { sed -E 's#^[a-z]+://[^@]*@([^/:?]+).*#\1#' <<<"$1"; }

for url in "$OLD_DATABASE_URL_DIRECT" "$NEW_DATABASE_URL_DIRECT"; do
  [[ $(host "$url") != *-pooler* ]] || { echo "$(host "$url") is a pooled host. Use the direct URL." >&2; exit 1; }
done

[[ $(sql "$OLD_DATABASE_URL_DIRECT" "show server_version_num") == 17* ]] || { echo "source is not PostgreSQL 17" >&2; exit 1; }
[[ $(sql "$NEW_DATABASE_URL_DIRECT" "show server_version_num") == 18* ]] || { echo "target is not PostgreSQL 18" >&2; exit 1; }

target=$(host "$NEW_DATABASE_URL_DIRECT")
if [[ ${CONFIRM_OVERWRITE:-} != "$target" ]]; then
  echo "This replaces all app data on $target. Set CONFIRM_OVERWRITE=$target to continue." >&2
  exit 1
fi

tables="select table_schema || '.' || table_name from information_schema.tables
  where table_schema in ('public', 'drizzle') and table_type = 'BASE TABLE' order by 1"
extra=$(comm -13 <(sql "$OLD_DATABASE_URL_DIRECT" "$tables") <(sql "$NEW_DATABASE_URL_DIRECT" "$tables"))
if [[ -n $extra ]]; then
  printf 'Target has tables the source lacks, so it is probably already live:\n%s\n' "$extra" >&2
  exit 1
fi

dump=$(mktemp)
trap 'rm -f "$dump"' EXIT
"$PG_BIN/pg_dump" -Fc --no-owner --no-acl -n public -n drizzle -f "$dump" "$OLD_DATABASE_URL_DIRECT"
"$PG_BIN/pg_restore" --clean --if-exists --no-owner --no-acl --single-transaction --exit-on-error \
  -d "$NEW_DATABASE_URL_DIRECT" "$dump"

fingerprint="select table_schema || '.' || table_name || ' ' || (xpath('/row/f/text()', query_to_xml(format(
    'select count(*) || '' '' || coalesce(md5(string_agg(t::text, E''\n'' order by t::text)), ''-'') as f from %I.%I t',
    table_schema, table_name), false, true, '')))[1]::text
  from information_schema.tables
  where table_schema in ('public', 'drizzle') and table_type = 'BASE TABLE' order by 1"
if diff <(sql "$OLD_DATABASE_URL_DIRECT" "$fingerprint") <(sql "$NEW_DATABASE_URL_DIRECT" "$fingerprint"); then
  echo "Copied $(sql "$NEW_DATABASE_URL_DIRECT" "$tables" | wc -l) tables to $target. Row counts and content hashes match."
else
  echo "Source and target differ (lines above). Do not cut over." >&2
  exit 1
fi
