# Tastory: contexto para o Claude Code

Protótipo acadêmico (UFAL, Gerência de Projeto 2026.2): API de diário de filmes/séries + recomendador
híbrido, com integração real ao TMDB. Guia da API em `docs/API.md`; pitch em `docs/pitch-tastory.pdf`;
`docs/PLANO.md` é histórico. Para tarefas maiores, use o agente `.claude/agents/tastory-expert.md`.

A interface fica em `frontend/`, sob responsabilidade da Lara. Mudanças nela precisam respeitar o contrato
de `docs/API.md`. O escopo atual está em `docs/MVP.md`, e os requisitos, em `docs/requisitos/`.

## Comandos

- Subir a API: `./dev.sh` (http://localhost:8000/docs) · recriar banco: `./dev.sh --reset`
- Subir tudo com PostgreSQL: `docker compose up --build` (interface em http://localhost:5173)
- Testes: `.venv/bin/pip install -r backend/requirements-dev.txt`, uma vez, e depois
  `cd backend && ../.venv/bin/python -m pytest -q`
  (`-m "not integration"` = offline; `-m integration` = TMDB real, precisa da chave no `.env`)
- Recriar banco: `cd backend && ../.venv/bin/python -m scripts.seed`
- Mudou rotas/schemas? Regere `docs/openapi.json`:
  `cd backend && TASTORY_AUTO_SEED=false ../.venv/bin/python -c "import json; from app.main import app; json.dump(app.openapi(), open('../docs/openapi.json','w'), ensure_ascii=False, indent=2)"`

## Regras

- Escopo: protótipo. Priorize funcionar e ser fácil de explicar, não perfeição.
- Fora do escopo agora: álbuns (incremento 2).
- As tarefas sobem para a branch `homol`; a `main` só recebe a versão aprovada pelo QA.
- **Segredos:** a chave do TMDB fica só no `.env` (gitignored). Nunca a escreva em código, testes,
  commits, issues ou logs. O repositório é público.
- Textos, docs e mensagens de commit em português.
- Toda rota nova ganha teste em `backend/tests/`. Mantenha os testes verdes.
