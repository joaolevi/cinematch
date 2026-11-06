#!/usr/bin/env bash
# Sobe a API + o protótipo de interface (demo-front) para apresentações.
# Uso: ./demo.sh          (Ctrl+C encerra os dois)
#      ./demo.sh --reset  (recria o banco: mock + populares do TMDB, se houver chave no .env)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ -f .env ]; then set -a; . ./.env; set +a; fi

if [ ! -x .venv/bin/python ]; then
  echo ">> Criando ambiente virtual Python (.venv)..."
  python3 -m venv .venv || {
    echo "Falha ao criar o venv. No Ubuntu/Debian/WSL rode: sudo apt install python3-venv"; exit 1; }
fi
.venv/bin/pip install -q -r backend/requirements.txt
[ -d frontend/node_modules ] || (cd frontend && npm install)

if [ "${1:-}" = "--reset" ]; then
  echo ">> Recriando banco (mock + TMDB)..."
  (cd backend && ../.venv/bin/python -m scripts.seed --tmdb)
fi

trap 'kill 0' EXIT INT TERM
(cd backend && ../.venv/bin/uvicorn app.main:app --port 8000) &
(cd frontend && npm run dev -- --host 127.0.0.1) &
sleep 2
echo ""
echo ">> Interface: http://localhost:5173   (demo@cinematch.dev / demo123 · admin@cinematch.dev / admin123)"
echo ">> API:       http://localhost:8000/docs"
wait
