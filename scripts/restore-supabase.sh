#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Uso: scripts/restore-supabase.sh

Restaura um backup Talhivo em projeto descartavel. Restauracao direta no
project ref de producao e bloqueada.

Variaveis obrigatorias:
  RESTORE_ARCHIVE
  RESTORE_AGE_IDENTITY
  RESTORE_TARGET_DB_URL
  RESTORE_TARGET_PROJECT_REF
  RESTORE_TARGET_SUPABASE_URL
  RESTORE_TARGET_SERVICE_ROLE_KEY
  RESTORE_CONFIRM_TARGET=RESTORE:<project-ref>
  PRODUCTION_PROJECT_REF
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
  RESTORE_ARCHIVE \
  RESTORE_AGE_IDENTITY \
  RESTORE_TARGET_DB_URL \
  RESTORE_TARGET_PROJECT_REF \
  RESTORE_TARGET_SUPABASE_URL \
  RESTORE_TARGET_SERVICE_ROLE_KEY \
  RESTORE_CONFIRM_TARGET \
  PRODUCTION_PROJECT_REF
do
  require_env "$name"
done

for command in age node psql tar; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Comando obrigatorio ausente: %s\n' "$command" >&2
    exit 1
  fi
done

if [[ ! -f "$RESTORE_ARCHIVE" ]]; then
  printf 'Arquivo de backup nao encontrado.\n' >&2
  exit 1
fi
if [[ "$RESTORE_TARGET_PROJECT_REF" == "$PRODUCTION_PROJECT_REF" ]]; then
  printf 'Restauracao direta em producao bloqueada.\n' >&2
  exit 1
fi
if [[ "$RESTORE_CONFIRM_TARGET" != "RESTORE:${RESTORE_TARGET_PROJECT_REF}" ]]; then
  printf 'Confirmacao do destino invalida.\n' >&2
  exit 1
fi
if [[ "$RESTORE_TARGET_DB_URL" != *"$RESTORE_TARGET_PROJECT_REF"* ]]; then
  printf 'RESTORE_TARGET_DB_URL nao corresponde ao project ref informado.\n' >&2
  exit 1
fi

if ! target_api_ref="$(node -e 'const host=new URL(process.argv[1]).hostname; const suffix=".supabase.co"; if(!host.endsWith(suffix)) process.exit(2); process.stdout.write(host.slice(0,-suffix.length));' "$RESTORE_TARGET_SUPABASE_URL")"; then
  printf 'RESTORE_TARGET_SUPABASE_URL invalida.\n' >&2
  exit 1
fi
if [[ "$target_api_ref" != "$RESTORE_TARGET_PROJECT_REF" ]]; then
  printf 'RESTORE_TARGET_SUPABASE_URL nao corresponde ao project ref informado.\n' >&2
  exit 1
fi

db_url="$RESTORE_TARGET_DB_URL"
if [[ "$db_url" != *"sslmode="* ]]; then
  if [[ "$db_url" == *\?* ]]; then
    db_url="${db_url}&sslmode=require"
  else
    db_url="${db_url}?sslmode=require"
  fi
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/talhivo-restore.XXXXXX")"
cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT INT TERM

if [[ -f "${RESTORE_ARCHIVE}.sha256" ]]; then
  expected_hash="$(tr -d '[:space:]' <"${RESTORE_ARCHIVE}.sha256")"
  actual_hash="$(node "$ROOT_DIR/scripts/backup-manifest.mjs" digest "$RESTORE_ARCHIVE")"
  if [[ "$expected_hash" != "$actual_hash" ]]; then
    printf 'Checksum do arquivo criptografado invalido.\n' >&2
    exit 1
  fi
fi

archive="$work_dir/payload.tar.gz"
age --decrypt --identity "$RESTORE_AGE_IDENTITY" --output "$archive" "$RESTORE_ARCHIVE"

while IFS= read -r entry; do
  clean_entry="${entry#./}"
  if [[ "$clean_entry" == /* || "/$clean_entry/" == *"/../"* ]]; then
    printf 'Caminho inseguro no arquivo de backup.\n' >&2
    exit 1
  fi
done < <(tar -tzf "$archive")

payload="$work_dir/payload"
mkdir -p "$payload"
tar -xzf "$archive" -C "$payload"
node "$ROOT_DIR/scripts/backup-manifest.mjs" \
  verify "$payload" "$payload/manifest.json"

source_ref="$(node -e 'const fs=require("node:fs"); const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(value.projectRef||""));' "$payload/metadata.json")"
if [[ -z "$source_ref" || "$source_ref" == "$RESTORE_TARGET_PROJECT_REF" ]]; then
  printf 'Origem do backup invalida para este destino.\n' >&2
  exit 1
fi

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$payload/database/roles.sql" \
  --file "$payload/database/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$payload/database/data.sql" \
  --dbname "$db_url"

if [[ "${RESTORE_SKIP_STORAGE:-0}" != "1" ]]; then
  RESTORE_SUPABASE_URL="$RESTORE_TARGET_SUPABASE_URL" \
  RESTORE_SUPABASE_SERVICE_ROLE_KEY="$RESTORE_TARGET_SERVICE_ROLE_KEY" \
  RESTORE_CONFIRM_TARGET="$RESTORE_CONFIRM_TARGET" \
  PRODUCTION_PROJECT_REF="$PRODUCTION_PROJECT_REF" \
  node "$ROOT_DIR/scripts/supabase-storage-backup.mjs" restore "$payload/storage"
fi

printf 'Restauracao concluida no projeto descartavel %s.\n' "$RESTORE_TARGET_PROJECT_REF"
printf 'Execute reconciliacao, RLS, login e fluxos criticos antes de aceitar o ensaio.\n'
