# Como contribuir

## Fluxo de trabalho

1. Pegue uma **issue** no quadro do projeto (ou crie uma) e atribua a você.
2. Atualize a `homol` e crie uma branch:
   ```bash
   git checkout homol && git pull
   git checkout -b feat/nome-curto      # feat/, fix/, docs/, test/, refactor/
   ```
3. Faça commits pequenos e descritivos, em português:
   `feat: adiciona filtro por década na busca`, `fix: corrige nota média no detalhe`.
4. Rode os testes antes de subir:
   ```bash
   pip install -r backend/requirements-dev.txt   # uma vez: instala o pytest
   cd backend && python -m pytest -q
   ```
   Os testes de integração com o TMDB rodam só se você tiver a chave no `.env`. Sem chave, eles são pulados.
5. `git push -u origin feat/nome-curto` e abra um **Pull Request** para a `homol`, com `Closes #N`
   na descrição.
6. Peça revisão de pelo menos uma pessoa da equipe. Só faça merge com o **CI verde**.
7. Depois do merge, o QA testa a tarefa na `homol`.

## Branches e versões

- **`main`:** versão estável. Recebe o MVP entregue em 10/11/2026 e, depois, cada incremento aprovado pelo QA.
- **`homol`:** recebe os Pull Requests. É a versão que o QA testa e que fica publicada durante os testes.
- **Branches de tarefa:** saem da `homol` e voltam para ela.

Para marcar versões estáveis, usamos tags:

- **Teste com pessoas:** ninguém faz merge durante o teste, e a versão testada na `homol` ganha a tag
  `homologacao-AAAA-MM-DD` ([roteiro](docs/gestao/HOMOLOGACAO.md)).
- **Problema encontrado:** a correção entra por Pull Request na `homol` depois da sessão, e o QA testa de novo.
- **Entrega:** com a aprovação do QA, a `homol` sobe para a `main`, que ganha uma tag. O MVP fica com
  `entrega-10-11`, e cada incremento com `incremento-<número>`, como `incremento-2a`.

```bash
git switch main && git pull
git tag entrega-10-11
git push origin entrega-10-11
```

## Documentação

O índice está em [docs/README.md](docs/README.md). Ao mudar a situação de um requisito futuro, atualize a linha dele
no arquivo do tipo (`funcionais.md` ou `nao-funcionais.md`) e no [plano de incrementos](docs/requisitos/incrementos.md).

## Organização no GitHub

- **Milestones** = estágios do PRINCE2 do pitch: *Iniciação*, *Execução*, *Transição*.
- **Issues** = pacotes de trabalho da EAP (2.1 Acesso, 2.2 Registro, 3.4 Recomendação, …).
- **Labels**: `frontend`, `backend`, `recomendação`, `docs`, `testes`, `incremento-2`.

## Convenções

- Backend: Python 3.12+, FastAPI, SQLAlchemy 2. Regras de domínio em `app/crud.py` e `app/services/`;
  os routers só validam a entrada e chamam essas funções.
- Novas rotas precisam de teste em `backend/tests/`.
- Mudou rotas ou schemas? Atualize `docs/tecnico/API.md` e regenere `docs/tecnico/openapi.json` (comando no `CLAUDE.md`):
  é o contrato que o frontend usa.
- **Nunca** commite a chave do TMDB nem o `.env`. O repositório é público.
- Textos da interface em português.
- Se mudar o modelo de dados, rode `python -m scripts.seed` para recriar o banco local (não há migrações).

## Usando o Claude Code

O repositório tem um agente especialista em `.claude/agents/tastory-expert.md` e contexto geral em
`CLAUDE.md`. No Claude Code, peça por exemplo: *"use o agente tastory-expert para adicionar um filtro
por década na busca"*.
