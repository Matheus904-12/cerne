/**
 * Utilitários de autenticação compartilhados entre as API routes.
 * Arquivos com _ não são tratados como Vercel Functions.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.SESSION_SECRET || 'cerne-dev-insecure-change-me';

export function createToken() {
  const ts = Date.now();
  const payload = `cerne:${ts}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

export function verifyToken(token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const lastColon = decoded.lastIndexOf(':');
    if (lastColon === -1) return false;
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expectedSig = createHmac('sha256', SECRET).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig.padEnd(64, '0'), 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (!timingSafeEqual(sigBuf.slice(0, expBuf.length), expBuf)) return false;
    const ts = parseInt(payload.split(':')[1]);
    return (Date.now() - ts) < 30 * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

// Retorna true se autorizado, false (e já setou 401) se não.
export function authCheck(req, res) {
  if (!process.env.BOARD_PASSWORD) return true; // board aberto — senha não configurada
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (verifyToken(token)) return true;
  res.status(401).json({ error: 'Não autenticado' });
  return false;
}
