#!/usr/bin/env node
/**
 * Verifica lembretes e prazos próximos, envia email + Telegram + push notification.
 * Roda no GitHub Actions (cron a cada 15 min).
 *
 * Secrets do GitHub Actions:
 *   SMTP_USER, SMTP_PASS, MAIL_TO         → e-mail via Gmail
 *   TELEGRAM_TOKEN, TELEGRAM_CHAT_ID      → Telegram bot
 *   BOARD_URL                             → URL do app Vercel (ex: https://cerne.vercel.app)
 *   BOARD_PASSWORD                        → senha do board (para autenticar na API)
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(__dirname, "../data/tasks.json");
const hoje      = new Date().toISOString().slice(0, 10);
const amanha    = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
const em2dias   = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
const agora     = Date.now();

// ─── Carregar board ──────────────────────────────────────
let db = null;

if (process.env.BOARD_URL && process.env.BOARD_PASSWORD) {
  try {
    const r = await fetch(`${process.env.BOARD_URL}/api/board`, {
      headers: { Authorization: `Bearer ${process.env.BOARD_PASSWORD}` },
    });
    if (r.ok) { db = await r.json(); console.log("Board carregado do Vercel."); }
  } catch (e) {
    console.log("Fallback para arquivo local:", e.message);
  }
}

if (!db) {
  try {
    db = JSON.parse(await readFile(FILE, "utf8"));
    console.log("Board carregado do arquivo local.");
  } catch (e) {
    if (e.code === "ENOENT") { console.log("data/tasks.json não encontrado."); process.exit(0); }
    throw e;
  }
}

// ─── Lembretes com data passada ──────────────────────────
const pendentes = (db.tarefas || []).filter(
  (t) => t.lembrete && !t.notificadoEm && new Date(t.lembrete).getTime() <= agora && !t.concluido
);

// ─── Tarefas com prazo nos próximos 2 dias ───────────────
const vencendo = (db.tarefas || []).filter(
  (t) => !t.concluido && t.prazo && (t.prazo === hoje || t.prazo === amanha || t.prazo === em2dias)
);

if (!pendentes.length && !vencendo.length) {
  console.log("Nenhum lembrete ou prazo próximo.");
  process.exit(0);
}

// ─── Funções de envio ────────────────────────────────────
function corpo(t) {
  const prazo = t.prazo ? `\nPrazo: ${new Date(t.prazo + "T12:00").toLocaleDateString("pt-BR")}` : "";
  return `🔔 Lembrete de tarefa\n\n${t.titulo}\n[${t.coluna}] · prioridade ${t.prioridade}${prazo}\n\n${t.descricao || ""}`;
}

async function enviarEmail(t) {
  if (!process.env.SMTP_USER) return;
  const tr = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await tr.sendMail({
    from: `"Cerne" <${process.env.SMTP_USER}>`,
    to: process.env.MAIL_TO || process.env.SMTP_USER,
    subject: `🔔 ${t.titulo}`,
    text: corpo(t),
  });
  console.log("E-mail enviado:", t.id);
}

async function enviarTelegram(t) {
  if (!process.env.TELEGRAM_TOKEN) return;
  const r = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: corpo(t) }),
    }
  );
  if (!r.ok) throw new Error("Telegram HTTP " + r.status);
  console.log("Telegram enviado:", t.id);
}

async function enviarPush(title, body, tag = "cerne") {
  if (!process.env.BOARD_URL || !process.env.BOARD_PASSWORD) return;
  try {
    const r = await fetch(`${process.env.BOARD_URL}/api/push-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BOARD_PASSWORD}`,
      },
      body: JSON.stringify({ title, body, tag }),
    });
    const j = await r.json().catch(() => ({}));
    console.log(`Push: ${j.sent ?? 0} enviado(s), ${j.failed ?? 0} falha(s) — ${tag}`);
  } catch (e) {
    console.log("Push falhou:", e.message);
  }
}

// ─── Processar lembretes ─────────────────────────────────
for (const t of pendentes) {
  try {
    await enviarEmail(t);
    await enviarTelegram(t);
    await enviarPush(`🔔 ${t.titulo}`, corpo(t), `lembrete-${t.id}`);
    t.notificadoEm = new Date().toISOString();
  } catch (e) {
    console.error("Falha ao notificar lembrete", t.id, e.message);
  }
}

// ─── Push para prazos próximos ───────────────────────────
for (const t of vencendo) {
  const when = t.prazo === hoje ? "hoje" : t.prazo === amanha ? "amanhã" : "em 2 dias";
  await enviarPush(
    `⏰ Tarefa vencendo ${when}`,
    `"${t.titulo}" vence ${when}.`,
    `prazo-${t.id}-${hoje}`
  );
}

// ─── Salvar mudanças locais (só quando não usa Vercel API) ─
if (pendentes.length && !process.env.BOARD_URL) {
  await writeFile(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
  console.log("tasks.json atualizado com notificadoEm.");
}

console.log(`Lembretes processados: ${pendentes.length}. Prazos próximos notificados: ${vencendo.length}.`);
