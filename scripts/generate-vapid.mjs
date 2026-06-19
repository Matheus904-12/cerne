#!/usr/bin/env node
/**
 * Gera chaves VAPID para notificações push.
 * Execute uma vez: node scripts/generate-vapid.mjs
 * Depois adicione as chaves nas variáveis de ambiente do Vercel e no GitHub Actions.
 */
import { generateVAPIDKeys } from 'web-push';

const keys = generateVAPIDKeys();
const subject = process.argv[2] || 'mailto:matheus.lucindo@bcrcx.com';

console.log('\n─── Chaves VAPID geradas ───────────────────────────────');
console.log('\nAdicione no Vercel (Settings → Environment Variables):');
console.log(`  VAPID_PUBLIC_KEY  = ${keys.publicKey}`);
console.log(`  VAPID_PRIVATE_KEY = ${keys.privateKey}`);
console.log(`  VAPID_SUBJECT     = ${subject}`);
console.log('\nAdicione no GitHub (Settings → Secrets → Actions):');
console.log(`  BOARD_URL         = https://seu-app.vercel.app`);
console.log(`  BOARD_PASSWORD    = <sua senha do board>`);
console.log('\n⚠️  Mantenha VAPID_PRIVATE_KEY e BOARD_PASSWORD em segredo.\n');
