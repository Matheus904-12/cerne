import { authCheck } from './_auth.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!await authCheck(req, res)) return;

  const DB_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_DATABASE_URL;
  if (!DB_URL) return res.status(503).json({ error: 'Banco não configurado' });

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(DB_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  if (req.method === 'POST') {
    const sub = req.body;
    if (!sub?.endpoint) return res.status(400).json({ error: 'Assinatura inválida' });
    const id = Buffer.from(sub.endpoint).toString('base64').slice(-48);
    await sql`
      INSERT INTO push_subscriptions (id, subscription)
      VALUES (${id}, ${JSON.stringify(sub)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET subscription = ${JSON.stringify(sub)}::jsonb
    `;
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { endpoint } = req.body ?? {};
    if (endpoint) {
      const id = Buffer.from(endpoint).toString('base64').slice(-48);
      await sql`DELETE FROM push_subscriptions WHERE id = ${id}`;
    }
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
