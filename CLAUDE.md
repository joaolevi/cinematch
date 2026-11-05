# CineMatch: contexto para o Claude Code

Protótipo acadêmico (UFAL, Gerência de Projeto 2026.2): API de diário de filmes/séries + recomendador
híbrido, com integração real ao TMDB. Plano em `docs/PLANO.md`; guia da API em `docs/API.md`;
pitch em `docs/pitch-cinematch.pdf`. Para tarefas maiores, use o agente `.claude/agents/cinematch-expert.md`.

O **frontend oficial é de outro integrante** e fica fora deste repositório. `demo-front/` é só um
protótipo para apresentação: não invista nele sem pedido explícito.

## Comandos

- Subir a API: `./dev.sh` (http://localhost:8000/docs) · recriar banco: `./dev.sh --reset`
- Testes: `cd backend && ../.venv/bin/python -m pytest -q`
  (`-m "not integration"` = offline; `-m integration` = TMDB real, precisa da chave no `.env`)
- Recriar banco: `cd backend && ../.venv/bin/python -m scripts.seed`
- Mudou rotas/schemas? Regere `docs/openapi.json`:
  `cd backend && CINEMATCH_AUTO_SEED=false ../.venv/bin/python -c "import json; from app.main import app; json.dump(app.openapi(), open('../docs/openapi.json','w'), ensure_ascii=False, indent=2)"`

## Regras

- Escopo: protótipo. Priorize funcionar e ser fácil de explicar, não perfeição.
- Fora do escopo agora: álbuns (incremento 2) e deploy.
- **Segredos:** a chave do TMDB fica só no `.env` (gitignored). Nunca a escreva em código, testes,
  commits, issues ou logs. O repositório é público.
- Textos, docs e mensagens de commit em português.
- Toda rota nova ganha teste em `backend/tests/`. Mantenha os testes verdes.
