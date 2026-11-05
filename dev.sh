#!/usr/bin/env bash
# Sobe o backend (FastAPI, porta 8000) e o frontend (Vite, porta 5173) juntos.
# Uso: ./dev.sh          (Ctrl+C encerra os dois)
#      ./dev.sh --reset  (recria o banco com os dados de demonstração antes de subir)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ -f .env ]; then set -a; . ./.env; set +a; fi

if [ ! -x .venv/bin/python ]; then
  echo ">> Criando ambiente virtual Python (.venv)..."
  python3 -m venv .venv || {
    echo "Falha ao criar o venv. No Ubuntu/Debian/WSL rode: sudo apt install python3-venv"; exit 1; }
fi
echo ">> Instalando dependências do backend..."
.venv/bin/pip install -q -r backend/requirements.txt

if [ ! -d frontend/node_modules ]; then
  echo ">> Instalando dependências do frontend..."
  (cd frontend && npm install)
fi

if [ "${1:-}" = "--reset" ]; then
  echo ">> Recriando banco de dados..."
  (cd backend && ../.venv/bin/python -m scripts.seed)
fi

trap 'kill 0' EXIT INT TERM
(cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8000) &
(cd frontend && npm run dev -- --host 127.0.0.1) &
echo ""
echo ">> API:      http://localhost:8000/docs"
echo ">> Frontend: http://localhost:5173"
wait
