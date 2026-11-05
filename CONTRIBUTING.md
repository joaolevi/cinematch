# Como contribuir

## Fluxo de trabalho

1. Pegue uma **issue** no quadro do projeto (ou crie uma) e atribua a você.
2. Atualize a `main` e crie uma branch:
   ```bash
   git checkout main && git pull
   git checkout -b feat/nome-curto      # feat/, fix/, docs/, test/, refactor/
   ```
3. Faça commits pequenos e descritivos, em português:
   `feat: adiciona filtro por década na busca`, `fix: corrige nota média no detalhe`.
4. Rode os testes antes de subir:
   ```bash
   cd backend && python -m pytest -q
   cd frontend && npm run build
   ```
5. `git push -u origin feat/nome-curto` e abra um **Pull Request** para a `main`, com `Closes #N`
   na descrição.
6. Peça revisão de pelo menos uma pessoa da equipe. Só faça merge com o **CI verde**.

## Organização no GitHub

- **Milestones** = estágios do PRINCE2 do pitch: *Iniciação*, *Execução*, *Transição*.
- **Issues** = pacotes de trabalho da EAP (2.1 Acesso, 2.2 Registro, 3.4 Recomendação, …).
- **Labels**: `frontend`, `backend`, `recomendação`, `docs`, `testes`, `incremento-2`.

## Convenções

- Backend: Python 3.11+, FastAPI, SQLAlchemy 2. Regras de domínio em `app/crud.py` e `app/services/`;
  os routers só validam a entrada e chamam essas funções.
- Novas rotas precisam de teste em `backend/tests/`.
- Frontend: componentes funcionais em TypeScript; chamadas HTTP **só** por `src/api.ts`;
  estilos com Tailwind usando as cores do tema (`bg-surface`, `text-accent`, …).
- Textos da interface em português.
- Se mudar o modelo de dados, rode `python -m scripts.seed` para recriar o banco local (não há migrações).

## Usando o Claude Code

O repositório tem um agente especialista em `.claude/agents/cinematch-expert.md` e contexto geral em
`CLAUDE.md`. No Claude Code, peça por exemplo: *"use o agente cinematch-expert para adicionar um filtro
por década na busca"*.
