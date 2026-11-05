# CineMatch — contexto para o Claude Code

Protótipo acadêmico (UFAL, Gerência de Projeto 2026.2): diário de filmes/séries + recomendador híbrido.
Plano completo em `docs/PLANO.md`; pitch original em `docs/pitch-cinematch.pdf`.
Para tarefas maiores, use o agente `.claude/agents/cinematch-expert.md`.

## Comandos

- Subir tudo: `./dev.sh` (API :8000, front :5173) · recriar banco: `./dev.sh --reset`
- Testes backend: `cd backend && ../.venv/bin/python -m pytest -q`
- Checagem do front: `cd frontend && npm run build`
- Recriar banco: `cd backend && ../.venv/bin/python -m scripts.seed`

## Regras

- Escopo: protótipo. Priorize funcionar e ser fácil de explicar, não perfeição.
- Fora do escopo agora: álbuns (incremento 2), TMDB real, deploy.
- Textos de UI, docs e mensagens de commit em português.
- Toda rota nova ganha teste em `backend/tests/`. Mantenha os testes e o build verdes.
- Frontend fala com a API só via `frontend/src/api.ts`, tipos em `frontend/src/types.ts`.
