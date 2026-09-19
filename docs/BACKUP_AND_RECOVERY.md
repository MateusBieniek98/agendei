# Backup e recuperação operacional

Este procedimento atende ao RPO máximo de 24 horas e ao RTO alvo de 4 horas.
Ele complementa, mas não substitui, os backups gerenciados do Supabase Pro.
Backups do banco não contêm os arquivos do Storage, portanto os dois conjuntos
são exportados no mesmo artefato criptografado.

Referências oficiais:

- [Backups do banco](https://supabase.com/docs/guides/platform/backups)
- [Backup e restore pela CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Download de objetos do Storage](https://supabase.com/docs/guides/storage/management/download-objects)

## Pré-requisitos

- projeto de produção no plano Pro com backup diário gerenciado habilitado;
- host dedicado de backup com Node.js, Docker, `supabase`, `age`, `rclone`,
  `tar` e `psql` instalados;
- remote do `rclone` em provedor diferente do Supabase, com versionamento,
  retenção e acesso mínimo;
- par de chaves `age`; somente a chave pública fica no host de backup;
- credenciais de banco e `service_role` entregues por cofre de segredos, nunca
  por arquivo versionado;
- projeto Supabase descartável para o ensaio de restauração.

A versão da CLI validada ao criar este procedimento foi `2.117.0`. Atualizações
devem passar por novo ensaio de backup e restore.

## Variáveis do backup

| Variável | Uso |
| --- | --- |
| `SUPABASE_DB_URL` | conexão do session pooler ou conexão direta |
| `SUPABASE_PROJECT_REF` | identificador do projeto de origem |
| `BACKUP_SUPABASE_URL` | URL da API do projeto de origem |
| `BACKUP_SUPABASE_SERVICE_ROLE_KEY` | leitura privada de todos os buckets |
| `BACKUP_AGE_RECIPIENT` | chave pública de criptografia |
| `BACKUP_OFFSITE_REMOTE` | destino `rclone`, por exemplo `cofre:talhivo` |

O script força TLS no banco, usa diretório temporário com permissão restrita,
exporta roles/schema/dados, baixa todos os buckets e objetos, calcula SHA-256,
criptografa antes do envio e baixa novamente o artefato remoto para conferir a
integridade. Os arquivos em claro são removidos pelo `trap` mesmo em falha.

```bash
scripts/backup-supabase.sh
```

Agende diariamente no executor protegido. O agendador deve alertar em qualquer
saída diferente de zero e também quando não houver um novo artefato válido em
26 horas. A retenção recomendada é 35 cópias diárias; a política de exclusão
fica no provedor externo, não no script.

## Ensaio de restauração

Baixe o arquivo `.age` e seu `.sha256` no host isolado. Configure:

| Variável | Uso |
| --- | --- |
| `RESTORE_ARCHIVE` | caminho local do arquivo criptografado |
| `RESTORE_AGE_IDENTITY` | chave privada `age` fora do repositório |
| `RESTORE_TARGET_DB_URL` | banco do projeto descartável |
| `RESTORE_TARGET_PROJECT_REF` | ref do projeto descartável |
| `RESTORE_TARGET_SUPABASE_URL` | URL da API do destino |
| `RESTORE_TARGET_SERVICE_ROLE_KEY` | chave exclusiva do destino |
| `PRODUCTION_PROJECT_REF` | ref de produção, usada como bloqueio |
| `RESTORE_CONFIRM_TARGET` | valor exato `RESTORE:<ref-do-destino>` |

```bash
scripts/restore-supabase.sh
```

O script rejeita produção, destino igual à origem, checksum inválido, caminhos
inseguros e confirmação incorreta. O banco é restaurado em transação única com
triggers suspensos durante a carga; os objetos são enviados com `upsert` e sua
configuração de bucket, tipo de conteúdo e cache é preservada quando disponível.

Depois da execução:

1. aplique somente migrations posteriores ao ponto restaurado;
2. reconcilie contagens, totais, estoque, anexos e órfãos;
3. valide login, recuperação de senha, RLS e todos os papéis;
4. valide download de cada classe de arquivo privado;
5. registre RPO, RTO, hashes, logs e decisão no relatório do ensaio;
6. destrua o projeto somente depois da aprovação e preservação da evidência.

Qualquer diferença de dados, arquivo ausente, quebra de RLS ou duração acima de
4 horas reprova o ensaio. A primeira execução deve ser acompanhada; o script não
é autorização para restaurar produção.
