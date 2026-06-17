#!/usr/bin/env node
/**
 * Verifica lembretes vencidos em data/tasks.json e dispara notificações.
 * Roda no GitHub Actions (cron). Tudo grátis: SMTP Gmail + Telegram Bot API.
 *
 * Marca cada lembrete como "notificado" gravando notificadoEm na tarefa,
 * para não reenviar. Faz commit de volta no repo se houver mudanças.
 *
 * Variáveis de ambiente (Secrets do repo):
 *   SMTP_USER, SMTP_PASS         -> Gmail + App Password
 *   MAIL_TO                      -> e-mail destino
 *   TELEGRAM_TOKEN, TELEGRAM_CHAT_ID
 */
import { readFile, writeFile } from "node:fs/promises";
import nodemailer from "nodemailer";

const FILE = "data/tasks.json";
const agora = Date.now();

const db = JSON.parse(await readFile(FILE, "utf8"));
const pendentes = db.tarefas.filter(
  (t) => t.lembrete && !t.notificadoEm && new Date(t.lembrete).getTime() <= agora && !t.concluido
);

if (!pendentes.length) {
  console.log("Nenhum lembrete pendente.");
  process.exit(0);
}

function corpo(t) {
  const prazo = t.prazo ? `\nPrazo: ${new Date(t.prazo).toLocaleDateString("pt-BR")}` : "";
  return `🔔 Lembrete de tarefa\n\n${t.titulo}\n[${t.coluna}] · prioridade ${t.prioridade}${prazo}\n\n${t.descricao || ""}`;
}

async function enviarEmail(t) {
  if (!process.env.SMTP_USER) return;
  const tr = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await tr.sendMail({
    from: `"Board" <${process.env.SMTP_USER}>`,
    to: process.env.MAIL_TO || process.env.SMTP_USER,
    subject: `🔔 ${t.titulo}`,
    text: corpo(t),
  });
  console.log("E-mail enviado:", t.id);
}

async function enviarTelegram(t) {
  if (!process.env.TELEGRAM_TOKEN) return;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: corpo(t) }),
  });
  if (!r.ok) throw new Error("Telegram HTTP " + r.status);
  console.log("Telegram enviado:", t.id);
}

for (const t of pendentes) {
  try {
    await enviarEmail(t);
    await enviarTelegram(t);
    t.notificadoEm = new Date().toISOString();
  } catch (e) {
    console.error("Falha ao notificar", t.id, e.message);
  }
}

await writeFile(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
console.log(`Processados ${pendentes.length} lembrete(s).`);
