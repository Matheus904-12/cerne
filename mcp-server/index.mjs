#!/usr/bin/env node
/**
 * MCP Server do Board — fonte da verdade = arquivos do repo.
 * Expõe ferramentas para o Claude Code: criar/listar/mover/editar tarefas
 * e gerar arquivos de texto livres (.md) no SEU formato.
 *
 * Sem banco de dados. Tudo em /data/tasks.json e /notes/*.md.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

// Raiz do repo: passe via env REPO_ROOT, senão usa o pai de mcp-server/
const REPO_ROOT = process.env.REPO_ROOT
  ? resolve(process.env.REPO_ROOT)
  : resolve(dirname(new URL(import.meta.url).pathname), "..");

const TASKS_FILE = join(REPO_ROOT, "data", "tasks.json");
const NOTES_KB_FILE = join(REPO_ROOT, "data", "notes.json");
const NOTES_DIR = join(REPO_ROOT, "notes");

// Obsidian: se OBSIDIAN_VAULT apontar para a vault, notas são espelhadas lá.
const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT
  ? resolve(process.env.OBSIDIAN_VAULT)
  : null;
// Notion: token e database id da integração oficial (opcional).
const NOTION_TOKEN = process.env.NOTION_TOKEN || null;
const NOTION_DB_ID = process.env.NOTION_DB_ID || null;

async function carregar() {
  const raw = await readFile(TASKS_FILE, "utf8");
  return JSON.parse(raw);
}
async function salvar(db) {
  db.board.atualizadoEm = new Date().toISOString();
  await writeFile(TASKS_FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
}
function novoId(db) {
  const nums = db.tarefas
    .map((t) => parseInt((t.id || "").replace("t-", ""), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return "t-" + String(next).padStart(4, "0");
}
function slug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

const server = new Server(
  { name: "cerne", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: "criar_tarefa",
    description: "Cria uma nova tarefa no board.",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        descricao: { type: "string" },
        coluna: { type: "string", description: "id da coluna (default: backlog)" },
        prioridade: { type: "string", enum: ["baixa", "media", "alta"] },
        tags: { type: "array", items: { type: "string" } },
        prazo: { type: "string", description: "ISO date ou null" },
        lembrete: { type: "string", description: "ISO datetime p/ notificação ou null" },
      },
      required: ["titulo"],
    },
  },
  {
    name: "listar_tarefas",
    description: "Lista tarefas, opcionalmente filtrando por coluna.",
    inputSchema: {
      type: "object",
      properties: { coluna: { type: "string" } },
    },
  },
  {
    name: "mover_tarefa",
    description: "Move uma tarefa para outra coluna.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        coluna: { type: "string" },
      },
      required: ["id", "coluna"],
    },
  },
  {
    name: "editar_tarefa",
    description: "Edita campos de uma tarefa existente.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        titulo: { type: "string" },
        descricao: { type: "string" },
        prioridade: { type: "string", enum: ["baixa", "media", "alta"] },
        prazo: { type: "string" },
        lembrete: { type: "string" },
        concluido: { type: "boolean" },
      },
      required: ["id"],
    },
  },
  {
    name: "remover_tarefa",
    description: "Remove uma tarefa do board.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "gerar_nota",
    description:
      "Cria um arquivo de texto livre (.md) em /notes no SEU formato. Pode vincular a uma tarefa.",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        conteudo: { type: "string", description: "Markdown livre, formato à sua escolha" },
        vincularTarefa: { type: "string", description: "id da tarefa para vincular (opcional)" },
      },
      required: ["titulo", "conteudo"],
    },
  },
  {
    name: "sincronizar_obsidian",
    description:
      "Espelha as tarefas do board para a vault do Obsidian como uma nota Markdown (Kanban por colunas). Requer OBSIDIAN_VAULT configurado.",
    inputSchema: {
      type: "object",
      properties: {
        arquivo: { type: "string", description: "nome do arquivo na vault (default: Board.md)" },
      },
    },
  },
  {
    name: "sincronizar_notion",
    description:
      "Envia as tarefas do board para uma database do Notion via API oficial. Requer NOTION_TOKEN e NOTION_DB_ID. Cria uma página por tarefa.",
    inputSchema: {
      type: "object",
      properties: {
        apenasColuna: { type: "string", description: "limita a uma coluna (opcional)" },
      },
    },
  },
  // ── KNOWLEDGE BASE (data/notes.json) ──
  {
    name: "criar_nota_kb",
    description: "Cria uma nota na base de conhecimento do Cerne (data/notes.json). Aceita blocos estruturados ou Markdown simples.",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        conteudo_md: { type: "string", description: "Markdown livre — convertido em blocos automaticamente" },
        blocos: { type: "array", description: "Blocos estruturados (alternativa ao conteudo_md)", items: { type: "object" } },
        tags: { type: "array", items: { type: "string" } },
        tarefaVinculada: { type: "string", description: "id da tarefa relacionada (opcional)" },
        fonte: { type: "string", description: "origem da nota: cerne | notion | obsidian (default: cerne)" },
      },
      required: ["titulo"],
    },
  },
  {
    name: "listar_notas_kb",
    description: "Lista as notas da base de conhecimento, com filtro opcional.",
    inputSchema: {
      type: "object",
      properties: {
        busca: { type: "string" },
        tag: { type: "string" },
        tarefaVinculada: { type: "string" },
      },
    },
  },
  {
    name: "editar_nota_kb",
    description: "Edita título, blocos ou tags de uma nota existente.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        titulo: { type: "string" },
        conteudo_md: { type: "string", description: "Substitui todos os blocos pelo Markdown fornecido" },
        blocos: { type: "array", items: { type: "object" } },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["id"],
    },
  },
  {
    name: "excluir_nota_kb",
    description: "Remove uma nota da base de conhecimento.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "importar_do_notion",
    description: "Busca uma página do Notion e importa como nota na base de conhecimento do Cerne. Requer NOTION_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "ID ou URL da página do Notion" },
        tarefaVinculada: { type: "string", description: "id de tarefa para vincular (opcional)" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["pageId"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const agora = new Date().toISOString();
  const ok = (txt) => ({ content: [{ type: "text", text: txt }] });

  try {
    if (name === "criar_tarefa") {
      const db = await carregar();
      const tarefa = {
        id: novoId(db),
        titulo: args.titulo,
        descricao: args.descricao || "",
        coluna: args.coluna || "backlog",
        prioridade: args.prioridade || "media",
        tags: args.tags || [],
        prazo: args.prazo || null,
        lembrete: args.lembrete || null,
        notaVinculada: null,
        criadoEm: agora,
        atualizadoEm: agora,
        concluido: false,
      };
      db.tarefas.push(tarefa);
      await salvar(db);
      return ok(`Tarefa criada: ${tarefa.id} — "${tarefa.titulo}" em [${tarefa.coluna}]`);
    }

    if (name === "listar_tarefas") {
      const db = await carregar();
      let ts = db.tarefas;
      if (args.coluna) ts = ts.filter((t) => t.coluna === args.coluna);
      if (!ts.length) return ok("Nenhuma tarefa encontrada.");
      const linhas = ts.map(
        (t) =>
          `• [${t.id}] ${t.titulo} — ${t.coluna} | ${t.prioridade}` +
          (t.prazo ? ` | prazo: ${t.prazo}` : "")
      );
      return ok(linhas.join("\n"));
    }

    if (name === "mover_tarefa") {
      const db = await carregar();
      const t = db.tarefas.find((x) => x.id === args.id);
      if (!t) return ok(`Tarefa ${args.id} não encontrada.`);
      t.coluna = args.coluna;
      t.atualizadoEm = agora;
      if (args.coluna === "feito") t.concluido = true;
      await salvar(db);
      return ok(`Tarefa ${t.id} movida para [${args.coluna}].`);
    }

    if (name === "editar_tarefa") {
      const db = await carregar();
      const t = db.tarefas.find((x) => x.id === args.id);
      if (!t) return ok(`Tarefa ${args.id} não encontrada.`);
      for (const k of ["titulo", "descricao", "prioridade", "prazo", "lembrete", "concluido"]) {
        if (args[k] !== undefined) t[k] = args[k];
      }
      t.atualizadoEm = agora;
      await salvar(db);
      return ok(`Tarefa ${t.id} atualizada.`);
    }

    if (name === "remover_tarefa") {
      const db = await carregar();
      const antes = db.tarefas.length;
      db.tarefas = db.tarefas.filter((x) => x.id !== args.id);
      if (db.tarefas.length === antes) return ok(`Tarefa ${args.id} não encontrada.`);
      await salvar(db);
      return ok(`Tarefa ${args.id} removida.`);
    }

    if (name === "gerar_nota") {
      if (!existsSync(NOTES_DIR)) await mkdir(NOTES_DIR, { recursive: true });
      const nome = `${slug(args.titulo)}.md`;
      const caminho = join(NOTES_DIR, nome);
      const cabecalho = `---\ntitulo: ${args.titulo}\ncriadoEm: ${agora}\n---\n\n`;
      const conteudoFinal = cabecalho + args.conteudo + "\n";
      await writeFile(caminho, conteudoFinal, "utf8");

      // Espelha na vault do Obsidian, se configurada.
      let espelho = "";
      if (OBSIDIAN_VAULT) {
        if (!existsSync(OBSIDIAN_VAULT)) await mkdir(OBSIDIAN_VAULT, { recursive: true });
        await writeFile(join(OBSIDIAN_VAULT, nome), conteudoFinal, "utf8");
        espelho = " (espelhada no Obsidian)";
      }

      if (args.vincularTarefa) {
        const db = await carregar();
        const t = db.tarefas.find((x) => x.id === args.vincularTarefa);
        if (t) {
          t.notaVinculada = `notes/${nome}`;
          t.atualizadoEm = agora;
          await salvar(db);
        }
      }
      return ok(`Nota criada: notes/${nome}${espelho}`);
    }

    if (name === "sincronizar_obsidian") {
      if (!OBSIDIAN_VAULT)
        return ok("OBSIDIAN_VAULT não configurado. Defina a variável de ambiente com o caminho da sua vault.");
      if (!existsSync(OBSIDIAN_VAULT)) await mkdir(OBSIDIAN_VAULT, { recursive: true });
      const db = await carregar();
      const arquivo = args.arquivo || "Board.md";
      let md = `---\nfonte: board-projeto\nsincronizadoEm: ${agora}\n---\n\n# ${db.board.nome}\n\n`;
      for (const col of db.colunas.sort((a, b) => a.ordem - b.ordem)) {
        const ts = db.tarefas.filter((t) => t.coluna === col.id);
        md += `## ${col.nome} (${ts.length})\n\n`;
        for (const t of ts) {
          const check = t.concluido ? "x" : " ";
          const meta = [t.etiqueta, t.prioridade, t.prazo].filter(Boolean).join(" · ");
          md += `- [${check}] **${t.titulo}**${meta ? ` — _${meta}_` : ""}\n`;
          if (t.descricao) md += `  - ${t.descricao}\n`;
        }
        md += "\n";
      }
      await writeFile(join(OBSIDIAN_VAULT, arquivo), md, "utf8");
      return ok(`Board sincronizado para Obsidian: ${arquivo} (${db.tarefas.length} tarefas).`);
    }

    if (name === "sincronizar_notion") {
      if (!NOTION_TOKEN || !NOTION_DB_ID)
        return ok("NOTION_TOKEN e NOTION_DB_ID são necessários. Configure a integração oficial do Notion.");
      const db = await carregar();
      let ts = db.tarefas;
      if (args.apenasColuna) ts = ts.filter((t) => t.coluna === args.apenasColuna);
      const colNome = (id) => (db.colunas.find((c) => c.id === id) || {}).nome || id;
      let enviadas = 0;
      const erros = [];
      for (const t of ts) {
        const props = {
          Name: { title: [{ text: { content: t.titulo } }] },
          Status: { select: { name: colNome(t.coluna) } },
          Prioridade: { select: { name: t.prioridade } },
        };
        if (t.etiqueta) props.Etiqueta = { select: { name: t.etiqueta } };
        if (t.prazo) props.Prazo = { date: { start: t.prazo } };
        try {
          const r = await fetch("https://api.notion.com/v1/pages", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${NOTION_TOKEN}`,
              "Notion-Version": "2022-06-28",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              parent: { database_id: NOTION_DB_ID },
              properties: props,
              children: t.descricao
                ? [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: t.descricao } }] } }]
                : [],
            }),
          });
          if (r.ok) enviadas++;
          else erros.push(`${t.id}: HTTP ${r.status}`);
        } catch (e) {
          erros.push(`${t.id}: ${e.message}`);
        }
      }
      return ok(
        `Notion: ${enviadas} página(s) criada(s).` + (erros.length ? ` Erros: ${erros.join("; ")}` : "")
      );
    }

    // ── KNOWLEDGE BASE ─────────────────────────────────────
    async function carregarNotes() {
      if (!existsSync(NOTES_KB_FILE)) return { version: 1, atualizadoEm: new Date().toISOString(), notas: [] };
      return JSON.parse(await readFile(NOTES_KB_FILE, "utf8"));
    }
    async function salvarNotes(db) {
      db.atualizadoEm = new Date().toISOString();
      await writeFile(NOTES_KB_FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
    }
    function noteNextId(db) {
      const nums = (db.notas || []).map(n => parseInt((n.id || "").replace("n-", ""), 10)).filter(x => !isNaN(x));
      return "n-" + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0");
    }
    function blockNextId(nota) {
      const nums = (nota.blocos || []).map(b => parseInt((b.id || "").replace("b-", ""), 10)).filter(x => !isNaN(x));
      return "b-" + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0");
    }
    function mdToBlocos(md) {
      const linhas = md.split("\n");
      const blocos = [];
      let codeBuffer = null, codeLinhas = [], codeLang = "";
      let bIdx = 1;
      function newId() { return "b-" + String(bIdx++).padStart(4, "0"); }
      for (const l of linhas) {
        if (l.startsWith("```")) {
          if (codeBuffer === null) { codeBuffer = true; codeLang = l.slice(3).trim() || "js"; codeLinhas = []; }
          else { blocos.push({ id: newId(), tipo: "code", linguagem: codeLang, conteudo: codeLinhas.join("\n") }); codeBuffer = null; }
          continue;
        }
        if (codeBuffer) { codeLinhas.push(l); continue; }
        if (l.startsWith("# ")) blocos.push({ id: newId(), tipo: "h1", conteudo: l.slice(2) });
        else if (l.startsWith("## ")) blocos.push({ id: newId(), tipo: "h2", conteudo: l.slice(3) });
        else if (l.startsWith("### ")) blocos.push({ id: newId(), tipo: "h3", conteudo: l.slice(4) });
        else if (l.startsWith("> ")) blocos.push({ id: newId(), tipo: "quote", conteudo: l.slice(2) });
        else if (l.trim() === "---" || l.trim() === "___") blocos.push({ id: newId(), tipo: "divider", conteudo: "" });
        else if (l.trim()) blocos.push({ id: newId(), tipo: "para", conteudo: l });
      }
      return blocos.length ? blocos : [{ id: "b-0001", tipo: "para", conteudo: md }];
    }
    function notionBlockToCerne(block) {
      const rt = (arr) => (arr || []).map(r => r.plain_text || "").join("");
      const tipo = block.type;
      if (tipo === "heading_1") return { tipo: "h1", conteudo: rt(block.heading_1?.rich_text) };
      if (tipo === "heading_2") return { tipo: "h2", conteudo: rt(block.heading_2?.rich_text) };
      if (tipo === "heading_3") return { tipo: "h3", conteudo: rt(block.heading_3?.rich_text) };
      if (tipo === "paragraph") return { tipo: "para", conteudo: rt(block.paragraph?.rich_text) };
      if (tipo === "quote") return { tipo: "quote", conteudo: rt(block.quote?.rich_text) };
      if (tipo === "code") return { tipo: "code", linguagem: block.code?.language || "plain text", conteudo: rt(block.code?.rich_text) };
      if (tipo === "divider") return { tipo: "divider", conteudo: "" };
      if (tipo === "bookmark") return { tipo: "link", conteudo: block.bookmark?.caption?.map(r => r.plain_text).join("") || "", url: block.bookmark?.url || "" };
      if (tipo === "bulleted_list_item") return { tipo: "para", conteudo: "• " + rt(block.bulleted_list_item?.rich_text) };
      if (tipo === "numbered_list_item") return { tipo: "para", conteudo: rt(block.numbered_list_item?.rich_text) };
      return null;
    }

    if (name === "criar_nota_kb") {
      const db = await carregarNotes();
      const blocos = args.blocos?.length ? args.blocos : mdToBlocos(args.conteudo_md || "");
      let idx = 1;
      blocos.forEach(b => { if (!b.id) b.id = "b-" + String(idx++).padStart(4, "0"); });
      const nota = {
        id: noteNextId(db),
        titulo: args.titulo,
        icone: "📄",
        blocos,
        tags: args.tags || [],
        tarefaVinculada: args.tarefaVinculada || null,
        fonte: args.fonte || "cerne",
        criadoEm: agora,
        atualizadoEm: agora,
      };
      db.notas.unshift(nota);
      await salvarNotes(db);
      return ok(`Nota criada: ${nota.id} — "${nota.titulo}" (${blocos.length} bloco(s))`);
    }

    if (name === "listar_notas_kb") {
      const db = await carregarNotes();
      let ns = db.notas || [];
      if (args.tag) ns = ns.filter(n => (n.tags || []).includes(args.tag));
      if (args.tarefaVinculada) ns = ns.filter(n => n.tarefaVinculada === args.tarefaVinculada);
      if (args.busca) {
        const q = args.busca.toLowerCase();
        ns = ns.filter(n => n.titulo.toLowerCase().includes(q) || (n.blocos || []).some(b => (b.conteudo || "").toLowerCase().includes(q)));
      }
      if (!ns.length) return ok("Nenhuma nota encontrada.");
      return ok(ns.map(n => `• [${n.id}] ${n.titulo}${n.tags?.length ? " [" + n.tags.join(", ") + "]" : ""}  (${(n.blocos || []).length} blocos, ${n.fonte || "cerne"})`).join("\n"));
    }

    if (name === "editar_nota_kb") {
      const db = await carregarNotes();
      const nota = (db.notas || []).find(n => n.id === args.id);
      if (!nota) return ok(`Nota ${args.id} não encontrada.`);
      if (args.titulo !== undefined) nota.titulo = args.titulo;
      if (args.tags !== undefined) nota.tags = args.tags;
      if (args.blocos?.length) nota.blocos = args.blocos;
      else if (args.conteudo_md) nota.blocos = mdToBlocos(args.conteudo_md);
      nota.atualizadoEm = agora;
      await salvarNotes(db);
      return ok(`Nota ${nota.id} atualizada.`);
    }

    if (name === "excluir_nota_kb") {
      const db = await carregarNotes();
      const antes = (db.notas || []).length;
      db.notas = (db.notas || []).filter(n => n.id !== args.id);
      if (db.notas.length === antes) return ok(`Nota ${args.id} não encontrada.`);
      await salvarNotes(db);
      return ok(`Nota ${args.id} removida.`);
    }

    if (name === "importar_do_notion") {
      if (!NOTION_TOKEN) return ok("NOTION_TOKEN não configurado. Defina a variável de ambiente.");
      const pageId = args.pageId.replace(/.*notion\.so\/[^-]*-?/,"").replace(/-/g,"").slice(0,32)||args.pageId;
      const headers = { Authorization: `Bearer ${NOTION_TOKEN}`, "Notion-Version": "2022-06-28" };
      const pageRes = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { headers });
      if (!pageRes.ok) return ok(`Erro ao buscar página Notion: HTTP ${pageRes.status}`);
      const page = await pageRes.json();
      const titulo = page.properties?.title?.title?.map(r => r.plain_text).join("") ||
                     page.properties?.Name?.title?.map(r => r.plain_text).join("") || "Nota do Notion";
      const blocksRes = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, { headers });
      const blocksData = blocksRes.ok ? await blocksRes.json() : { results: [] };
      const blocos = (blocksData.results || []).map(notionBlockToCerne).filter(Boolean);
      let idx = 1;
      blocos.forEach(b => { b.id = "b-" + String(idx++).padStart(4, "0"); });
      const db = await carregarNotes();
      const nota = {
        id: noteNextId(db),
        titulo,
        icone: "📄",
        blocos: blocos.length ? blocos : [{ id: "b-0001", tipo: "para", conteudo: "" }],
        tags: args.tags || ["notion"],
        tarefaVinculada: args.tarefaVinculada || null,
        fonte: "notion",
        notionPageId: pageId,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      db.notas.unshift(nota);
      await salvarNotes(db);
      return ok(`Página do Notion importada: ${nota.id} — "${titulo}" (${blocos.length} bloco(s))`);
    }

    return ok(`Ferramenta desconhecida: ${name}`);
  } catch (err) {
    return ok(`Erro: ${err.message}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[cerne-mcp] rodando via stdio");
