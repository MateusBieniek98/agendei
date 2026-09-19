#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Uso: scripts/backup-supabase.sh

Cria dump do banco e dos objetos do Storage, valida checksums, criptografa com
age e envia o artefato para um destino rclone fora do Supabase.

Variaveis obrigatorias:
  SUPABASE_DB_URL
  SUPABASE_PROJECT_REF
  BACKUP_SUPABASE_URL
  BACKUP_SUPABASE_SERVICE_ROLE_KEY
  BACKUP_AGE_RECIPIENT
  BACKUP_OFFSITE_REMOTE
EOF
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    printf 'Variavel obrigatoria ausente: %s\n' "$name" >&2
    exit 1
  fi
}

for name in \
  SUPABASE_DB_URL \
  SUPABASE_PROJECT_REF \
  BACKUP_SUPABASE_URL \
  BACKUP_SUPABASE_SERVICE_ROLE_KEY \
  BACKUP_AGE_RECIPIENT \
  BACKUP_OFFSITE_REMOTE
do
  require_env "$name"
done

for command in supabase age rclone node tar; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Comando obrigatorio ausente: %s\n' "$command" >&2
    exit 1
  fi
done

if [[ ! "$SUPABASE_PROJECT_REF" =~ ^[a-z0-9]+$ ]]; then
  printf 'SUPABASE_PROJECT_REF invalido.\n' >&2
  exit 1
fi
if [[ "$SUPABASE_DB_URL" != *"$SUPABASE_PROJECT_REF"* ]]; then
  printf 'SUPABASE_DB_URL nao corresponde ao project ref informado.\n' >&2
  exit 1
fi
if [[ "$BACKUP_OFFSITE_REMOTE" != *:* || "$BACKUP_OFFSITE_REMOTE" == /* ]]; then
  printf 'BACKUP_OFFSITE_REMOTE deve apontar para um remote do rclone.\n' >&2
  exit 1
fi

db_url="$SUPABASE_DB_URL"
if [[ "$db_url" != *"sslmode="* ]]; then
  if [[ "$db_url" == *\?* ]]; then
    db_url="${db_url}&sslmode=require"
  else
    db_url="${db_url}?sslmode=require"
  fi
fi

lock_dir="${TALHIVO_BACKUP_LOCK_DIR:-${TMPDIR:-/tmp}/talhivo-backup.lock}"
if ! mkdir "$lock_dir" 2>/dev/null; then
  printf 'Outro backup parece estar em execucao: %s\n' "$lock_dir" >&2
  exit 1
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/talhivo-backup.XXXXXX")"
cleanup() {
  rm -rf "$work_dir" "$lock_dir"
}
trap cleanup EXIT INT TERM

timestamp="$(date -u '+%Y%m%dT%H%M%SZ')"
payload="$work_dir/payload"
mkdir -p "$payload/database" "$payload/storage"

supabase db dump --db-url "$db_url" --file "$payload/database/roles.sql" --role-only
supabase db dump --db-url "$db_url" --file "$payload/database/schema.sql"
supabase db dump \
  --db-url "$db_url" \
  --file "$payload/database/data.sql" \
  --use-copy \
  --data-only \
  --exclude "storage.buckets_vectors" \
  --exclude "storage.vector_indexes"

BACKUP_SUPABASE_URL="$BACKUP_SUPABASE_URL" \
BACKUP_SUPABASE_SERVICE_ROLE_KEY="$BACKUP_SUPABASE_SERVICE_ROLE_KEY" \
node "$ROOT_DIR/scripts/supabase-storage-backup.mjs" export "$payload/storage"

storage_ref="$(node -e 'const fs=require("node:fs"); const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(value.sourceProjectRef||""));' "$payload/storage/storage-manifest.json")"
if [[ "$storage_ref" != "$SUPABASE_PROJECT_REF" ]]; then
  printf 'BACKUP_SUPABASE_URL nao corresponde ao project ref informado.\n' >&2
  exit 1
fi

cat >"$payload/metadata.json" <<EOF
{
  "formatVersion": 1,
  "createdAt": "${timestamp}",
  "projectRef": "${SUPABASE_PROJECT_REF}",
  "rpoHours": 24
}
EOF

node "$ROOT_DIR/scripts/backup-manifest.mjs" \
  create "$payload" "$payload/manifest.json"
node "$ROOT_DIR/scripts/backup-manifest.mjs" \
  verify "$payload" "$payload/manifest.json"

archive_name="talhivo-${SUPABASE_PROJECT_REF}-${timestamp}.tar.gz.age"
encrypted_archive="$work_dir/$archive_name"
tar -C "$payload" -czf - . | age \
  --encrypt \
  --recipient "$BACKUP_AGE_RECIPIENT" \
  --output "$encrypted_archive"

archive_hash="$(node "$ROOT_DIR/scripts/backup-manifest.mjs" digest "$encrypted_archive")"
printf '%s\n' "$archive_hash" >"$encrypted_archive.sha256"

remote_base="${BACKUP_OFFSITE_REMOTE%/}"
remote_archive="$remote_base/$archive_name"
rclone copyto "$encrypted_archive" "$remote_archive"
rclone copyto "$encrypted_archive.sha256" "$remote_archive.sha256"

verification_copy="$work_dir/verification.age"
rclone copyto "$remote_archive" "$verification_copy"
verification_hash="$(node "$ROOT_DIR/scripts/backup-manifest.mjs" digest "$verification_copy")"
if [[ "$archive_hash" != "$verification_hash" ]]; then
  printf 'O artefato remoto diverge do backup local.\n' >&2
  exit 1
fi

printf 'Backup criptografado e verificado: %s\n' "$remote_archive"
