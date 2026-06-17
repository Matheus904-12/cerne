/**
 * POST /api/auth → login com senha → retorna token
 * GET  /api/auth → verifica token existente
 */
import { createToken, verifyToken } from './_auth.js';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export default function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET: verificar token
  if (req.method === 'GET') {
    if (!process.env.BOARD_PASSWORD) return res.status(200).json({ ok: true, open: true });
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (verifyToken(token)) return res.status(200).json({ ok: true });
    return res.status(401).json({ ok: false, error: 'Token inválido ou expirado' });
  }

  // POST: login
  if (req.method === 'POST') {
    if (!process.env.BOARD_PASSWORD) {
      return res.status(200).json({ token: createToken() });
    }
    if (req.body?.password === process.env.BOARD_PASSWORD) {
      return res.status(200).json({ token: createToken() });
    }
    return res.status(401).json({ error: 'Senha incorreta' });
  }

  res.status(405).end();
}
