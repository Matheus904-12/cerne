# Plano: Cerne — Deploy GitHub + Vercel + Banco de Dados Gratuito
**Data:** 2026-06-16  
**Status:** Em execução

## Escopo
1. Criar repositório privado `Matheus904-12/cerne` no GitHub
2. Hospedar o PWA no Vercel (URL pública)
3. Adicionar banco de dados gratuito (Neon Postgres via Vercel Marketplace)
4. Adicionar API routes (`api/`) para o backend
5. Atualizar frontend para chamar `/api/` em vez de GitHub API diretamente

## Decisões de arquitetura
- **GitHub**: código-fonte + versionamento (repositório privado)
- **Vercel Hobby**: hosting gratuito do PWA + serverless functions
- **Neon Postgres** (free tier): banco de dados — 0.5 GB, serverless driver
- **API routes**: `api/board.js` (GET/PUT), `api/tasks/[id].js` (PUT/DELETE), `api/migrate.js` (setup)
- **Frontend**: `pull()` e `push()` apontam para `/api/board`; fallback localStorage mantido

## Tarefas

- [x] Criar `.agent.rules.sdd.md` (constitution)
- [x] Criar `spec/repository_map.md`
- [x] Criar `spec/architecture/cerne-v2-database-vercel.md`
- [ ] Criar `vercel.json`
- [ ] Criar `api/` com as rotas (board.js, tasks/[id].js, migrate.js)
- [ ] Instalar `@neondatabase/serverless` nas devDependencies do projeto
- [ ] Atualizar `web/index.html` → pull/push para `/api/board`
- [ ] Remover modal de config GitHub do frontend (substituído por DB)
- [ ] Criar `package.json` raiz para as dependências do Vercel
- [ ] Inicializar git + criar repo GitHub `Matheus904-12/cerne`
- [ ] Deploy no Vercel (`vercel --prod`)
- [ ] Instruções para conectar Neon Postgres (requer ação manual na UI)
- [ ] Executar migração via `/api/migrate`

## Notas
- O `mcp-server/` e `scripts/` ficam no repo mas não são deployados no Vercel
- As GitHub Actions de lembretes continuam funcionando normalmente
- O `data/tasks.json` permanece no repo como seed inicial e backup
- O `.mcp.json` (segredos) continua git-ignored
