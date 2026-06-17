# Mapa do Repositório — Cerne

## Visão Geral
Board Kanban pessoal. Zero custo. Dados em arquivo JSON versionado no GitHub.

## Árvore de arquivos
```
cerne/
├── .agent.rules.sdd.md         # Regras do agente (Spec Kit Constitution)
├── .mcp.example.json           # Template do .mcp.json (git-ignored)
├── .gitignore
├── CLAUDE.md                   # Contexto do projeto para o Claude Code
├── README.md                   # Documentação do usuário final
├── deploy.sh                   # Script de deploy manual
│
├── data/
│   └── tasks.json              # FONTE DA VERDADE — board completo (colunas, tarefas, atividade)
│
├── notes/                      # Notas Markdown livres, criadas por gerar_nota
│
├── web/                        # PWA instalável (servida no GitHub Pages / Vercel)
│   ├── index.html              # App completo — todo o JS/CSS está inline aqui (~627 linhas)
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker (cache offline)
│   ├── icon-192.png
│   └── icon-512.png
│
├── mcp-server/
│   ├── index.mjs               # MCP Server Node.js ESM — expõe 8 ferramentas ao Claude Code
│   ├── package.json
│   └── package-lock.json
│
├── scripts/
│   ├── notify.mjs              # Script de lembretes (roda no GitHub Actions)
│   ├── package.json            # depende de: nodemailer
│   └── package-lock.json
│
└── .github/workflows/
    ├── lembretes.yml           # Cron a cada 15min: roda notify.mjs, faz commit
    └── pages.yml               # Deploy automático do web/ no GitHub Pages
```

## Fluxos principais

### 1. Leitura/escrita via PWA (browser)
```
Usuário abre web/index.html
  → pull(): GitHub Contents API → decodifica base64 → DB em memória + localStorage
  → render(): monta o Kanban via innerHTML
  → drag-drop / modal → altera DB em memória → push(): GitHub Contents API (PUT)
```

### 2. Operações via Claude Code (MCP)
```
Claude Code carrega .mcp.json → inicia mcp-server/index.mjs via stdio
Ferramentas disponíveis:
  criar_tarefa    → append em DB.tarefas + salvar()
  listar_tarefas  → filtragem por coluna
  mover_tarefa    → altera t.coluna
  editar_tarefa   → atualiza campos
  remover_tarefa  → splice de tarefas
  gerar_nota      → escreve notes/<slug>.md (+ espelho Obsidian se OBSIDIAN_VAULT)
  sincronizar_obsidian → gera Board.md na vault
  sincronizar_notion   → cria páginas via Notion API
```

### 3. Lembretes automáticos (GitHub Actions)
```
Cron */15 * * * * → scripts/notify.mjs
  → lê tasks.json, filtra t.lembrete <= agora && !t.notificadoEm && !t.concluido
  → enviarEmail() via nodemailer (Gmail)
  → enviarTelegram() via Bot API
  → grava t.notificadoEm → commit "board: marca lembretes notificados"
```

## Variáveis de ambiente
| Variável | Uso | Onde configurar |
|---|---|---|
| `REPO_ROOT` | Raiz do repo para o MCP server | `.mcp.json` env |
| `OBSIDIAN_VAULT` | Caminho da vault Obsidian | `.mcp.json` env |
| `NOTION_TOKEN` | Token da integração Notion | `.mcp.json` env |
| `NOTION_DB_ID` | ID da database Notion | `.mcp.json` env |
| `SMTP_USER` | Gmail para lembretes | GitHub Secrets |
| `SMTP_PASS` | App Password Gmail | GitHub Secrets |
| `MAIL_TO` | E-mail de destino | GitHub Secrets |
| `TELEGRAM_TOKEN` | Token do bot Telegram | GitHub Secrets |
| `TELEGRAM_CHAT_ID` | Chat ID do Telegram | GitHub Secrets |

## Estado atual (2026-06-16)
- PWA funcional: Kanban drag-drop, modal de tarefa, busca, sync GitHub
- MCP Server com 8 ferramentas
- GitHub Actions: lembretes + deploy Pages
- Tarefas de exemplo: 10 tarefas em 4 colunas (demo "Publications")
- **Não inicializado como git repo** — precisa de `git init` antes do deploy
