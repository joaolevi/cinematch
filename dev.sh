#!/usr/bin/env bash
# Sobe a API do Tastory (FastAPI) em http://localhost:8000 — documentação em /docs.
# Uso: ./dev.sh          (Ctrl+C encerra)
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
echo ">> Instalando dependências..."
.venv/bin/pip install -q -r backend/requirements.txt

cd backend
if [ "${1:-}" = "--reset" ]; then
  echo ">> Recriando banco de dados..."
  ../.venv/bin/python -m scripts.seed
fi

echo ">> API:  http://localhost:8000"
echo ">> Docs: http://localhost:8000/docs"
exec ../.venv/bin/uvicorn app.main:app --reload --port 8000
