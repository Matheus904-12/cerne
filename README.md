# Cerne — seu board de tarefas, os dados são seus

Board de tarefas independente, sem depender de Notion/Obsidian como software:
- **Dados** em arquivos versionados no seu repo (`data/tasks.json` + `notes/*.md`)
- **App** PWA instalável no celular e desktop, com design próprio
- **Claude Code** conectado via MCP — cria tarefas e gera notas no seu formato
- **Lembretes** por e-mail + Telegram, automáticos, 100% grátis (GitHub Actions)

---

## 1. Subir o repo

```bash
cd board-projeto
git init && git add . && git commit -m "board: setup inicial"
gh repo create board-projeto --private --source=. --push
# ou crie o repo no site e: git remote add origin ... && git push -u origin main
```

## 2. Conectar o Claude Code (MCP)

O arquivo `.mcp.json` já está pronto. Dentro da pasta do projeto:

```bash
cd mcp-server && npm install && cd ..
claude   # o Claude Code lê .mcp.json e carrega o servidor "cerne"
```

Aí é só pedir: *"cria uma tarefa X em fazendo com prazo sexta"* ou *"gera uma nota com o resumo da reunião e vincula à tarefa t-0003"*.

Ferramentas disponíveis: `criar_tarefa`, `listar_tarefas`, `mover_tarefa`, `editar_tarefa`, `remover_tarefa`, `gerar_nota`.

## 3. Publicar o app (PWA) — grátis

**Vercel** (recomendado): aponte para a pasta `web/`. Ou **GitHub Pages**:

```bash
# Settings > Pages > branch main, pasta /web  (ou mova web/ para /docs)
```

No celular: abra a URL → menu do navegador → **Adicionar à tela inicial**. Vira app.

No app, toque em **⚙︎** e preencha usuário, repo, branch e um **token do GitHub** (escopo `repo`, fino: `github_pat_...`). O token fica só no aparelho. A partir daí o app lê e grava o `tasks.json` direto no repo — sincroniza entre todos os seus dispositivos.

## 4. Lembretes (e-mail + Telegram) — grátis

Em **Settings > Secrets and variables > Actions**, crie:

| Secret | Como obter |
|---|---|
| `SMTP_USER` | seu Gmail |
| `SMTP_PASS` | App Password do Gmail (conta > segurança > senhas de app) |
| `MAIL_TO` | e-mail que recebe (pode ser o mesmo) |
| `TELEGRAM_TOKEN` | crie um bot com o @BotFather |
| `TELEGRAM_CHAT_ID` | mande msg pro bot e veja em `api.telegram.org/bot<TOKEN>/getUpdates` |

O workflow `.github/workflows/lembretes.yml` roda a cada 15 min, checa tarefas com `lembrete` vencido e dispara. Já testado.

> Telegram em vez de WhatsApp porque é oficial, gratuito de verdade e estável. WhatsApp grátis ou viola os termos (risco de ban) ou exige burocracia da API oficial da Meta.

## 5. Integrar Notion e Obsidian

- **Obsidian:** aponte a pasta `notes/` para sua vault, ou adicione a vault como submódulo git. O `gerar_nota` já escreve com front-matter no seu padrão.
- **Notion:** use o MCP oficial do Notion em paralelo no mesmo Claude Code; peça para espelhar tarefas quando quiser.

---

## Custo total: R$ 0
Repo privado, Vercel/Pages, GitHub Actions, Gmail SMTP e Telegram — todos no tier gratuito.

---

## Integração Notion + Obsidian

**Obsidian** — defina `OBSIDIAN_VAULT` no `.mcp.json` apontando para sua vault (ex.: a pasta do seu Cerebro/Jarvis). A partir daí:
- `gerar_nota` grava a nota também na vault.
- `sincronizar_obsidian` gera um `Board.md` Kanban (checkboxes por coluna) — funciona com os plugins Tasks/Kanban.

**Notion** — crie uma integração em notion.so/my-integrations, compartilhe sua database com ela, e preencha `NOTION_TOKEN` + `NOTION_DB_ID` no `.mcp.json`. A database precisa ter as propriedades: Name (title), Status (select), Prioridade (select), Etiqueta (select), Prazo (date). Depois é só pedir ao Claude: *"sincroniza o board com o Notion"*.

> O repo continua sendo a fonte da verdade. Notion e Obsidian são espelhos/saídas — você edita no board (app ou Claude) e propaga para os dois.
