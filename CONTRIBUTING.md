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

## Mudanças no banco

O banco muda só por migrações do Alembic (D25), em `backend/migrations/versions/`. A API aplica as pendentes ao subir.

1. Altere o modelo em `backend/app/models.py`.
2. Rode `make migration MSG="o que mudou"`. A migração sai numerada em sequência (`0002`, `0003`…), a partir da
   diferença entre os modelos e o banco local.
3. Revise o arquivo gerado: o Alembic não percebe renomeações (vê uma coluna apagada e outra criada) e não preenche dados.
   Coluna nova obrigatória em tabela com dados precisa de `server_default`.
4. Rode `make test`. O `test_migrations.py` falha se os modelos e as migrações divergirem.

Regras:

- Uma migração por PR.
- Uma migração que já chegou na `homol` nunca é editada. Para corrigir, crie outra.
- Não use `create_all` nem `ALTER TABLE` à mão. No código, use `atualizar_banco` (`app/migrations.py`); na linha de
  comando, `make migrate`. No SQLite, os dois desligam as chaves estrangeiras durante a migração: recriar uma tabela
  com elas ligadas apagaria, pelo `ON DELETE CASCADE`, os registros das tabelas filhas.
- `make seed` continua recriando o banco local do zero.

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
- Mudou rotas ou schemas? Regenere `docs/tecnico/openapi.json` com `make openapi`: o Swagger é o contrato que a
  interface usa (D26). Regras de uso vão na descrição da rota (`description=` no router), para aparecer no Swagger. O
  `docs/tecnico/API.md` só muda se mudar a autenticação, o fluxo das telas ou uma regra geral.
- **Nunca** commite a chave do TMDB nem o `.env`. O repositório é público.
- Textos da interface em português.
- Mudou o modelo de dados? Crie uma migração, como na seção abaixo.

## Usando o Claude Code

O repositório tem um agente especialista em `.claude/agents/tastory-expert.md` e contexto geral em
`CLAUDE.md`. No Claude Code, peça por exemplo: *"use o agente tastory-expert para adicionar um filtro
por década na busca"*.
