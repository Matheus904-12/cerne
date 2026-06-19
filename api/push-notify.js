import { authCheck } from './_auth.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await authCheck(req, res)) return;
  if (req.method !== 'POST') return res.status(405).end();

  const { title = 'Cerne', body = '', tag = 'cerne', url = '/' } = req.body ?? {};

  const DB_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_DATABASE_URL;
  const PUB   = process.env.VAPID_PUBLIC_KEY;
  const PRIV  = process.env.VAPID_PRIVATE_KEY;
  const SUBJ  = process.env.VAPID_SUBJECT || 'mailto:admin@cerne.app';

  if (!PUB || !PRIV) return res.status(503).json({ error: 'VAPID não configurado', ok: false });
  if (!DB_URL)       return res.status(503).json({ error: 'Banco não configurado', ok: false });

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(DB_URL);

  let rows = [];
  try {
    rows = await sql`SELECT id, subscription FROM push_subscriptions`;
  } catch {
    return res.status(200).json({ ok: true, sent: 0, note: 'Nenhuma assinatura' });
  }
  if (!rows.length) return res.status(200).json({ ok: true, sent: 0 });

  const { default: webpush } = await import('web-push');
  webpush.setVapidDetails(SUBJ, PUB, PRIV);

  const payload = JSON.stringify({ title, body, tag, url });
  let sent = 0, failed = 0;

  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 410 || e.statusCode === 404) {
        await sql`DELETE FROM push_subscriptions WHERE id = ${row.id}`.catch(() => {});
      }
    }
  }

  return res.status(200).json({ ok: true, sent, failed });
}
