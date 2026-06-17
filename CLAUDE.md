# Cerne — contexto para o Claude Code

Cerne é seu board de tarefas próprio. **Fonte da verdade = arquivos deste repo.** Sem banco, sem custo.

## Estrutura
- `data/tasks.json` — board (colunas + tarefas). Schema abaixo.
- `notes/*.md` — arquivos de texto livres, no MEU formato (não o de nenhum software).
- `web/` — PWA (board instalável no celular e desktop).
- `mcp-server/` — servidor MCP: ferramentas para você criar/editar tarefas e gerar notas.
- `scripts/notify.mjs` — envia lembretes (e-mail + Telegram) via GitHub Actions.

## Como agir
- Responda em **português**, direto, sem rodeios.
- Para mexer no board, use as ferramentas do MCP `board-projeto` (não edite o JSON na mão a menos que eu peça).
- Ao gerar documentos/notas, use `gerar_nota` — formato livre em Markdown, do meu jeito.
- Tarefas com `lembrete` (ISO datetime) viram notificação automática. Use quando eu pedir "me lembra".

## Schema de tarefa
```
id, titulo, descricao, coluna (backlog|fazendo|revisao|feito),
prioridade (baixa|media|alta), tags[], prazo (ISO date|null),
lembrete (ISO datetime|null), notaVinculada, criadoEm, atualizadoEm, concluido
```

## Integração com meu ecossistema
- **Obsidian/Cerebro:** as notas em `notes/` podem apontar para minha vault, ou eu sincronizo a vault como submódulo. `gerar_nota` segue meu padrão de front-matter.
- **Notion:** uso o MCP oficial do Notion em paralelo; quando eu pedir, espelhe tarefas entre o board e o Notion.

## Ferramentas de sincronização (novas)
- `sincronizar_obsidian` — espelha o board como `Board.md` na vault (Kanban com checkboxes). Requer env `OBSIDIAN_VAULT`.
- `sincronizar_notion` — cria uma página por tarefa numa database do Notion. Requer env `NOTION_TOKEN` + `NOTION_DB_ID`.
- `gerar_nota` agora também grava na vault do Obsidian quando `OBSIDIAN_VAULT` está definido.
