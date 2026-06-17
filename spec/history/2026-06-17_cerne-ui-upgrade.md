# Spec: Cerne UI Upgrade — 2026-06-17

**Arquivo alvo principal:** `web/index.html` (único arquivo, JS/CSS inline)
**Stack:** Vanilla JS + CSS puro. Nenhum framework externo.

---

## Fase 1 — Bugs Críticos (implementar PRIMEIRO, validar no console)

### T1 — Bug drag & drop: tarefas desaparecem
**Causa raiz:** Ao mover tarefa para coluna "feito", `t.concluido = true`. Ao mover de volta, `concluido` fica `true`. `applyFilters` oculta tarefas com `concluido=true` quando `showDone=false`.
**Fix:** No handler `drop`, adicionar `else t.concluido = false;` após `if(b.dataset.col==='feito')t.concluido=true;`

### T2 — Bug search input fundo branco
**Causa:** Browser aplica estilo nativo no `:focus`. Falta override webkit-autofill.
**Fix:** Adicionar ao CSS:
```css
.search input { background: transparent; }
.search input:-webkit-autofill, .search input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 100px #0e1117 inset;
  -webkit-text-fill-color: var(--ink);
}
```

---

## Fase 2 — Refinamentos Visuais

### T3 — Avatar eu.jpg
- Substituir `<div class="me-av">ME</div>` por `<img src="eu.jpg">` dentro do `.me-av`
- Adicionar `overflow:hidden` ao `.me-av` CSS

### T4 — Tooltips customizados
- Remover atributos `title` de todos os botões
- Adicionar `data-tip="..."` nos mesmos elementos
- Criar `<div id="tipEl" class="tip-el" hidden></div>` no body
- JS: mouseover/mouseleave em `[data-tip]` → posicionar e mostrar `#tipEl`

### T5 — Animações fade views
- Adicionar classe `.view-fade` com `animation: fadeUp .25s ease both` em cada view ao ser exibida
- Modais já têm animação `modalIn`. Adicionar `fadeOut` ao fechar (classe `.closing` + setTimeout para remover)

### T6 — Login premium
- Adicionar backdrop blur e gradient decorativo ao `.login-card`
- Leve glassmorphism: `background: rgba(14,17,22,.85); backdrop-filter: blur(20px)`

---

## Fase 3 — Avatar + Sons

### T7 — Sons (Web Audio API)
```js
function playSound(type) {
  const ctx = new AudioContext();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  if(type==='complete') { o.frequency.value=784; g.gain.setValueAtTime(.25,0); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime+.5); }
  if(type==='overdue')  { o.frequency.value=440; g.gain.setValueAtTime(.15,0); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime+.3); }
  o.start(); o.stop(ctx.currentTime + .55);
}
```
- Chamar `playSound('complete')` no drop handler quando `b.dataset.col === lastColId`
- Chamar `playSound('overdue')` no boot se houver tarefas com `prazo < hoje && !concluido`

---

## Fase 4 — Sidebar de Tarefa (duplo clique)

### T8 — Task Sidebar
**HTML:** `<div id="taskSidebar" class="task-sidebar">` — `position:fixed; right:0; top:0; bottom:0; width:312px`
**Abertura:** `dblclick` no `.card` → `openTaskSidebar(id)`
**Conteúdo:**
1. Cabeçalho: botão fechar + título da tarefa
2. Heatmap 7 dias: lê `t.timeLog['YYYY-MM-DD']` (novos segundos por dia)
3. Comentários: lista de `t.comentarios[]` + campo para adicionar
4. Timer per-task: `00:00:00` + play/pause → salva em `t.timeLog[hoje]` ao pausar

**Modelo de dados (novos campos nas tarefas):**
```
t.comentarios = [{id, texto, pessoa, criadoEm}]  // default []
t.timeLog = {'YYYY-MM-DD': seconds}               // default {}
```

**Estado JS:**
```js
let sbTaskId=null, sbRunning=false, sbSec=0, sbInterval=null;
```

---

## Fase 5 — Novas Telas

### T9 — View Mensagens (Global Inbox)
- Adicionar `messages: 'viewMessages'` no mapa `setView()`
- `<div id="viewMessages" class="messages-view" hidden>`
- `renderMessages()`: itera `DB.tarefas`, flatMap de `t.comentarios`, ordena por data, renderiza feed

### T10 — Modal Notificações (Sino)
- `<div class="scrim" id="scrimNotif">` com lista de tarefas atrasadas/hoje
- Evento click no `.bell` → `openNotifModal()`
- Separa: atrasadas (`prazo < hoje`), hoje (`prazo === hoje`), futuras próximas

### T11 — Tela Relatórios (skeleton)
- Substituir placeholder atual por grid de 4 cards de métricas (total tarefas, concluídas, em atraso, por membro)
- Valores calculados em tempo real do `DB.tarefas`

### T12 — Idiomas (Config Modal)
- Adicionar seção no modal de config: `<select id="c_lang">` com pt-BR / en / es
- `const LANGS = {ptBR:{...}, en:{...}, es:{...}}` — traduz strings principais
- Salva em `localStorage('cerne.lang')`; aplica ao boot via `applyLang()`

---

## Fase 6 — Assignees + Editor de Blocos

### T13 — Assignees no Modal de Tarefa
- Adicionar campo visual de avatars clicáveis no modal de tarefa
- Mostra `DB.pessoas`, toggle ao clicar, salva em `t.assignees[]`

### T14 — Editor de Blocos (Notion-like)
- Substituir `<textarea id="f_descricao">` por `<div id="f_editor" contenteditable="true" class="block-editor">`
- Ao digitar `/` no início de linha → mostra `<div id="blockMenu">` flutuante com opções: `h1, h2, text, bullet, code`
- Salva: `t.descricao = editor.innerText`, `t.descricao_html = editor.innerHTML`
- Ao abrir tarefa existente: se `t.descricao_html`, usa ele; senão, converte `t.descricao` em bloco texto

---

## Fase 7 — Mobile

### T15 — Responsividade Mobile (≤ 640px)
- Grid `.app` vira single column
- `.rail` vira bottom navigation bar (fixo, `bottom:0`)
- `.activity` oculta
- `.board` scroll horizontal com snap
- Cards com `min-width: 280px; max-width: 90vw`
- `.topbar` simplificado (apenas título + botão add)
- Ajustar `.modal` para `max-height: 95dvh` e padding menor

---

## Ordem de Execução

| # | Tarefa | Linhas estimadas |
|---|--------|-----------------|
| 1 | T1 + T2 (bugs) | ~5 linhas JS + ~8 CSS |
| 2 | T3 + T4 + T5 + T6 (visuais) | ~60 CSS + ~30 HTML + ~25 JS |
| 3 | T7 (sons) | ~20 JS |
| 4 | T8 (sidebar tarefa) | ~80 CSS + ~60 HTML + ~120 JS |
| 5 | T9 + T10 + T11 + T12 (telas) | ~50 CSS + ~80 HTML + ~100 JS |
| 6 | T13 + T14 (modal upgrade) | ~30 CSS + ~30 HTML + ~80 JS |
| 7 | T15 (mobile) | ~60 CSS |
| **Total** | | **~840 linhas novas** |

**Arquivo final estimado: ~2000 linhas** (atual: 1159)
