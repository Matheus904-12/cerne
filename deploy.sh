#!/usr/bin/env bash
#
# deploy.sh — sobe o board pro GitHub e liga o Pages.
# Rode na máquina onde o `gh` (GitHub CLI) está autenticado.
# Uso:  bash deploy.sh SEU_USUARIO NOME_DO_REPO
#
set -euo pipefail

OWNER="${1:?informe seu usuario do github: bash deploy.sh USUARIO REPO}"
REPO="${2:-cerne}"

echo "==> Verificando gh CLI"
command -v gh >/dev/null || { echo "Instale o GitHub CLI (gh) e rode 'gh auth login'."; exit 1; }
gh auth status >/dev/null || { echo "Rode 'gh auth login' primeiro."; exit 1; }

echo "==> Inicializando git"
git init -q
git add .
git -c user.name="$OWNER" -c user.email="$OWNER@users.noreply.github.com" \
    commit -qm "board: setup inicial pronto para produção"
git branch -M main

echo "==> Criando repositório privado e fazendo push"
gh repo create "$OWNER/$REPO" --private --source=. --remote=origin --push

echo "==> Habilitando GitHub Pages (via Actions)"
gh api -X POST "repos/$OWNER/$REPO/pages" \
  -f "build_type=workflow" 2>/dev/null || echo "   (Pages já habilitado ou será criado pelo workflow)"

echo ""
echo "================ PRÓXIMOS PASSOS (manuais, 1x) ================"
echo "1. Secrets para lembretes (Settings > Secrets and variables > Actions):"
echo "     SMTP_USER, SMTP_PASS, MAIL_TO, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID"
echo "   Ou via CLI, ex.:"
echo "     gh secret set SMTP_USER -b'seu@gmail.com' -R $OWNER/$REPO"
echo ""
echo "2. O app sai em: https://$OWNER.github.io/$REPO/"
echo "   (aguarde o workflow 'Deploy do app' terminar em Actions)"
echo ""
echo "3. No app, toque no ícone de sync (rail) e preencha owner/repo/branch/token"
echo "   para o board gravar direto no repo e sincronizar entre aparelhos."
echo "=============================================================="
