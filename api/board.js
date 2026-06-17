/**
 * GET  /api/board → retorna o board completo
 * PUT  /api/board → salva o board no banco
 */
import { authCheck } from './_auth.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SEED = require('../data/tasks.json');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!authCheck(req, res)) return;

  const DB_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_DATABASE_URL;
  if (!DB_URL) {
    if (req.method === 'GET') return res.status(200).json(SEED);
    if (req.method === 'PUT') return res.status(200).json({ ok: true, mode: 'localStorage' });
    return res.status(405).end();
  }

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(DB_URL);

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT data FROM board WHERE id = 'main'`;
      return res.status(200).json(rows.length > 0 ? rows[0].data : SEED);
    }

    if (req.method === 'PUT') {
      const data = req.body;
      if (!data?.board) return res.status(400).json({ error: 'Payload inválido' });
      data.board.atualizadoEm = new Date().toISOString();
      await sql`
        INSERT INTO board (id, data, updated_at)
        VALUES ('main', ${JSON.stringify(data)}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE
          SET data = ${JSON.stringify(data)}::jsonb, updated_at = NOW()
      `;
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('[api/board]', err.message);
    return res.status(500).json({ error: err.message });
  }

  res.status(405).end();
}
