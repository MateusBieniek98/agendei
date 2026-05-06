# GN — Gestão de Produção em Silvicultura

Web app responsivo (mobile-first) para a operação de silvicultura da **GN**:
lançamento diário de produção em campo, acompanhamento gerencial e visão
estratégica para tomada de decisão.

## Stack

| Camada              | Escolha                                |
| ------------------- | -------------------------------------- |
| Frontend            | Next.js 16 (App Router) + React 19     |
| Estilo              | Tailwind CSS v4                        |
| Backend / API       | Next.js Route Handlers (`app/api/*`)   |
| Banco               | PostgreSQL (Supabase) com RLS          |
| Auth                | Supabase Auth (email + senha)          |
| Gráficos            | Recharts                               |
| Exportação          | ExcelJS (XLSX) + CSV                   |
| Deploy sugerido     | Vercel + Supabase Cloud                |

## Estrutura

```
app/
  login/                  Tela de login
  (field)/                Encarregado: lançamento, máquinas, histórico do dia
    lancamento/
    maquinas/
    historico/
  admin/                  Admin: dashboard + CRUDs
    lancamentos/
    atividades/
    equipes/
    maquinas/
    metas/
    usuarios/
  gestor/                 Gestor: visão executiva única
  api/
    producao/             GET/POST + [id] PATCH/DELETE
    atividades/           CRUD
    equipes/              CRUD
    maquinas/             CRUD
    manutencoes/          GET/POST + [id] PATCH
    metas/                GET / upsert
    usuarios/             GET / PATCH
    dashboard/            agregações
    export/xlsx           XLSX (ExcelJS)
    export/csv            CSV (Power BI / Sheets)

components/
  branding/Logo.tsx       Logo SVG GN inline
  ui/                     Button, Input, Select, Card, Badge, Toast
  nav/                    BottomNav, Sidebar, TopBar, LogoutButton

lib/
  db/schema.sql           DDL completo (tabelas, RLS, views, triggers)
  db/seed.sql             Dados mockados para dev
  supabase/client.ts      Browser client
  supabase/server.ts      Server client (cookies)
  auth.ts                 requireSession / requireRole
  format.ts               BRL, datas, helpers
  integrations/           Google Sheets, Power BI, webhooks
  types.ts                Tipos compartilhados

proxy.ts                  Proxy do Next.js 16 (refresh sessão + guard)
```

## Pré-requisitos

- Node 20+
- Conta Supabase (gratuita — 500 MB Postgres já basta)

## Como rodar local

### 1. Clone e instale

```bash
npm install
cp .env.local.example .env.local
```

Preencha as variáveis com seu projeto Supabase
(Project Settings → API → URL + anon public).

### 2. Crie o schema no Supabase

No painel do Supabase → **SQL Editor** → cole e rode:

```
lib/db/schema.sql
```

(idempotente — pode rodar várias vezes)

### 3. Crie os 3 usuários de teste

Em **Authentication → Users → Add user** crie:

| E-mail                    | Senha       | Papel        |
| ------------------------- | ----------- | ------------ |
| `encarregado@gn.local`    | `gn123456`  | encarregado  |
| `admin@gn.local`          | `gn123456`  | admin        |
| `gestor@gn.local`         | `gn123456`  | gestor       |

> *Authentication → Users → Add user → "Auto Confirm User" marcado.*

### 4. Carregue os dados mockados

No SQL Editor, rode:

```
lib/db/seed.sql
```

O seed associa os usuários do passo 3 aos seus papéis e cria 4 equipes,
8 atividades de silvicultura, 6 máquinas, 2 manutenções abertas, meta
do mês corrente e ~36 lançamentos dos últimos 12 dias.

### 5. Suba o app

```bash
npm run dev
```

Abra http://localhost:3000 → faça login com qualquer um dos 3 usuários.

## Papéis e telas

| Papel        | Home          | O que vê                                                   |
| ------------ | ------------- | ---------------------------------------------------------- |
| Encarregado  | `/lancamento` | Form rápido de produção, problemas mecânicos, hoje         |
| Admin        | `/admin`      | Dashboard + CRUDs (lançamentos, atividades, equipes, máquinas, metas, usuários) |
| Gestor       | `/gestor`     | Visão executiva única (faturamento, % meta, frota, ranking) |

## Regras de negócio implementadas

- **Faturamento** = `Σ (quantidade × valor_unitario_snapshot)` — o valor é
  capturado **no momento do lançamento**, então alterar a tabela de
  atividades depois não afeta o histórico.
- **% da meta** = `produção do mês ÷ meta mensal × 100`
- **Meta do próximo dia** = `(meta − faturado) ÷ dias restantes no mês`
- **RLS por papel**:
  - encarregado: lê tudo do app, escreve só os próprios lançamentos e
    abre manutenções
  - admin: leitura/escrita total
  - gestor: leitura

## Auditoria

Todas as mutações em `producao`, `atividades`, `maquinas` e `metas` são
registradas na tabela `audit_log` (com `usuario_id` e diff em JSONB).
Visível só pelo papel admin.

## Exportações

- `GET /api/export/xlsx?escopo=mes|semana|hoje&data_de=&data_ate=`
- `GET /api/export/csv?...`  (formato amigável a Power BI / Sheets)
- `GET /api/sync/google-sheets/apontamentos?escopo=tudo` retorna JSON
  protegido por `GOOGLE_SHEETS_SYNC_TOKEN` para alimentar a planilha
  **Controle de Produção GN** por Apps Script.

Os apontamentos incluem projeto, talhão, atividade, equipe, produção,
tarifa, faturamento, até 5 insumos utilizados, descarte e observações.
Insumos são operacionais: aparecem para encarregado/admin/exportação,
mas não entram na tela do gestor.

Os adapters de integração ficam em `lib/integrations/`.

## Deploy

```bash
vercel --prod
```

No painel Vercel, configure as variáveis de ambiente do `.env.local`.
Aponte o domínio na DNS da GN.

Para a sincronização automática com Google Sheets, configure também:

- `SUPABASE_SERVICE_ROLE_KEY` — chave service role do projeto Supabase.
- `GOOGLE_SHEETS_SYNC_TOKEN` — token secreto compartilhado com o Apps Script.

## Licença

Propriedade da GN.
