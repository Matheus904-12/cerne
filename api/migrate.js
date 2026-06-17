/**
 * GET /api/migrate → cria tabelas e insere o seed inicial (rodar 1x após conectar o banco)
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SEED = require('../data/tasks.json');

// O prefixo da integração Neon pode variar (com ou sem DATABASE_URL_)
const DB_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_DATABASE_URL;

export default async function handler(req, res) {
  if (!DB_URL) {
    return res.status(503).json({
      error: 'DATABASE_URL não configurado.',
      instrucao: 'Conecte Neon Postgres via Vercel Marketplace e redefina as env vars.',
    });
  }

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(DB_URL);

  try {
    // Cria tabela se não existir
    await sql`
      CREATE TABLE IF NOT EXISTS board (
        id         TEXT PRIMARY KEY DEFAULT 'main',
        data       JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Insere seed somente se o board ainda não existe
    const rows = await sql`SELECT id FROM board WHERE id = 'main'`;
    if (rows.length === 0) {
      await sql`INSERT INTO board (id, data) VALUES ('main', ${JSON.stringify(SEED)}::jsonb)`;
      return res.status(200).json({ ok: true, acao: 'tabela criada + seed inserido' });
    }

    return res.status(200).json({ ok: true, acao: 'tabela já existia, nenhuma mudança' });
  } catch (err) {
    console.error('[api/migrate]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
