/**
 * JWT auth utilities — usa HS256 via `jose` (padrão RFC 7519).
 * Arquivos com _ não são tratados como Vercel Functions.
 */
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'cerne-dev-insecure-change-me'
);

const ALG = 'HS256';
const TTL = '30d';

export async function createToken() {
  return new SignJWT({ sub: 'cerne-user' })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret);
}

export async function verifyToken(token) {
  if (!token) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// Retorna true se autorizado; já responde 401 e retorna false caso contrário.
export async function authCheck(req, res) {
  if (!process.env.BOARD_PASSWORD) return true;
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (await verifyToken(token)) return true;
  res.status(401).json({ error: 'Não autenticado' });
  return false;
}
