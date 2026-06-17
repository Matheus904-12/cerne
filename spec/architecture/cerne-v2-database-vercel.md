# Especificação: Cerne v2 — GitHub + Vercel + Banco de Dados Gratuito

**Data:** 2026-06-16  
**Autor:** Jarvis Cognitive Engine  
**Status:** Rascunho — aguardando aprovação do Senhor Lucindo

---

## 1. Objetivo

Transformar o Cerne de um app estático com sincronização via GitHub API direta em uma aplicação completa com:

1. **Repositório GitHub privado** — versionamento de código e CI/CD
2. **Hospedagem no Vercel** — PWA disponível em URL pública + serverless functions
3. **Banco de dados gratuito** — armazenamento robusto, sem depender do GitHub API do browser

---

## 2. Stack Escolhida

| Camada | Tecnologia | Por quê |
|---|---|---|
| Frontend | PWA vanilla (mantido) | Zero refactor, funciona offline |
| Hosting | Vercel (plano Hobby — grátis) | CI/CD automático, custom domain, serverless |
| API Backend | Vercel Functions (`api/*.js`) | Serverless Node.js, zero configuração |
| Banco de dados | **Neon Postgres** (free tier via Vercel Marketplace) | 0.5 GB grátis, SQL completo, integração nativa |
| CI/CD | GitHub Actions (mantido) | Lembretes automáticos |

### Por que Neon Postgres e não outras opções?
- **Turso (SQLite)**: 9GB grátis, mas sem integração nativa no Marketplace da Vercel
- **Upstash Redis**: ótimo para cache, mas KV simples — sem queries SQL para filtros
- **Supabase**: free tier generoso, mas adiciona complexidade (Auth, RLS) desnecessária aqui
- **Neon**: Postgres completo, disponível no Vercel Marketplace com 1 clique, `@neondatabase/serverless` tem driver nativo para Edge/Functions

---

## 3. Arquitetura v2

### Fluxo de dados (novo)

```
Browser (PWA)
  ↕ fetch /api/board        ← GET: lê board completo
  ↕ fetch /api/tasks        ← POST: cria tarefa
  ↕ fetch /api/tasks/[id]   ← PUT/DELETE: edita/remove

Vercel Functions (api/)
  ↕ @neondatabase/serverless
  
Neon Postgres
  └─ tabela: board_state    (configuração e metadados do board)
  └─ tabela: tasks          (todas as tarefas)
```

### O que muda na sincronização
- **Antes**: browser ↔ GitHub Contents API (requer token no localStorage)
- **Depois**: browser ↔ `/api/*` no Vercel (sem token exposto no frontend)
- **Benefício**: dados seguros no servidor, sem PAT GitHub no dispositivo do usuário

### O que é mantido
- PWA installável (manifest, sw.js)
- Drag & drop Kanban
- Modal de criação/edição
- Design visual (100% sem alteração)
- GitHub Actions para lembretes (notify.mjs)
- MCP Server (adaptado para ler do banco)

---

## 4. Schema do Banco (Neon Postgres)

```sql
-- Metadados e configuração do board
CREATE TABLE board_state (
  id          TEXT PRIMARY KEY DEFAULT 'main',
  nome        TEXT NOT NULL DEFAULT 'Meu Board',
  colunas     JSONB NOT NULL,
  etiquetas   JSONB NOT NULL DEFAULT '{}',
  pessoas     JSONB NOT NULL DEFAULT '[]',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tarefas individuais
CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  titulo        TEXT NOT NULL,
  descricao     TEXT DEFAULT '',
  coluna        TEXT NOT NULL DEFAULT 'todo',
  prioridade    TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta')),
  etiqueta      TEXT,
  tags          JSONB NOT NULL DEFAULT '[]',
  prazo         DATE,
  lembrete      TIMESTAMPTZ,
  assignees     JSONB NOT NULL DEFAULT '[]',
  nota_vinculada TEXT,
  notificado_em TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  concluido     BOOLEAN NOT NULL DEFAULT FALSE
);

-- Atividade (feed)
CREATE TABLE activity (
  id      TEXT PRIMARY KEY,
  pessoa  TEXT NOT NULL,
  acao    TEXT NOT NULL,
  alvo    TEXT NOT NULL,
  extra   TEXT DEFAULT '',
  hora    TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5. API Routes (Vercel Functions)

```
api/
├── board.js         GET /api/board        → board_state + todas as tasks
├── tasks/
│   ├── index.js     POST /api/tasks       → INSERT task
│   └── [id].js      PUT|DELETE /api/tasks/[id] → UPDATE|DELETE task
└── migrate.js       GET /api/migrate      → cria tabelas (rodar 1x no setup)
```

### Segurança
- As functions ficam no servidor Vercel — `DATABASE_URL` nunca vai para o browser
- CORS configurado para aceitar somente o próprio domínio Vercel
- Sem autenticação por enquanto (board pessoal — URL não-óbvia = proteção suficiente)

---

## 6. Mudanças no Frontend (`web/index.html`)

| Antes | Depois |
|---|---|
| `pull()` → GitHub Contents API | `pull()` → `fetch('/api/board')` |
| `push()` → GitHub Contents API (PUT) | `push()` → `fetch('/api/board', {method:'PUT'})` |
| Modal config: usuário/repo/branch/token | Modal config: removido ou mantido como fallback |
| Offline: localStorage como fallback | Offline: localStorage como fallback (mantido) |

---

## 7. Estrutura final do projeto

```
cerne/
├── api/                      ← NOVO: Vercel Functions
│   ├── board.js              ← GET board completo
│   ├── migrate.js            ← Setup inicial do banco
│   └── tasks/
│       ├── index.js          ← POST criar tarefa
│       └── [id].js           ← PUT editar, DELETE remover
├── web/                      ← PWA (sem mudança visual)
│   └── index.html            ← Atualizado: calls /api/* em vez de GitHub API
├── mcp-server/
│   └── index.mjs             ← Atualizado: conecta no banco via DATABASE_URL
├── scripts/
│   └── notify.mjs            ← Atualizado: lê tasks do banco
├── vercel.json               ← NOVO: config de deploy
├── .env.example              ← NOVO: template de variáveis
└── spec/                     ← Documentação SDD
```

---

## 8. Deploy Flow

```bash
# 1. Git init + GitHub
git init && git add . && git commit -m "cerne: setup inicial"
gh repo create cerne --private --source=. --push

# 2. Vercel link
vercel link   # ou: vercel --yes

# 3. Neon via Vercel Marketplace (1 clique no dashboard)
#    → DATABASE_URL injetado automaticamente

# 4. Rodar migração 1x
curl https://seu-projeto.vercel.app/api/migrate

# 5. Deploy produção
vercel --prod
```

---

## 9. Itens fora do escopo desta versão
- Autenticação multi-usuário
- Time-tracking persistido no banco
- Comentários em tarefas
- Filtros avançados no frontend
