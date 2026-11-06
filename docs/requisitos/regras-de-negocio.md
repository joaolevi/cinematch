# Regras de negócio

> [Voltar ao índice](README.md) · A ligação com código e testes está no fim deste arquivo.

Quatro regras ainda não são cumpridas e entram como correção no MVP: **RN02, RN12, RN13 e RN14**. A RN16 também não
é cumprida, mas só entra se houver tempo.
RN12, RN13 e RN14 foram aprovadas por Sophia (GP) em 05/11/2026.

## Conta e acesso

| ID | Regra | Situação |
|---|---|---|
| RN01 | O e-mail é único, sem diferenciar maiúsculas de minúsculas | Atende |
| RN02 | A senha tem de 6 caracteres a 72 bytes; fora disso a API devolve erro de validação (422) | **Não atende:** 73 a 128 bytes geram erro 500 |
| RN09 | Cada usuário só acessa as próprias listas e os próprios registros | Atende |
| RN10 | As rotas `/admin` exigem perfil de administrador | Atende |

## Diário e listas

| ID | Regra | Situação |
|---|---|---|
| RN03 | A nota é opcional e vai de 0,5 a 5 em passos de 0,5 | Atende |
| RN04 | A resenha é opcional e tem até 2000 caracteres | Atende, sem teste |
| RN05 | Há um registro de diário por usuário e título; registrar de novo atualiza o existente | Atende, sem teste. Vale só para o MVP: o sistema final deve preservar o histórico ([RFF03](../ARQUITETURA.md#funcionais)) |
| RN06 | Registrar consumo tira o título da watchlist e dos descartes | Atende, sem teste |
| RN08 | A watchlist é criada no cadastro e não pode ser excluída nem renomeada | Atende |
| RN13 | Resenha oculta continua oculta quando o autor a edita; só o admin restaura | **Não atende:** editar reexibe a resenha |
| RN14 | Refazer o onboarding não altera notas que já existem | **Não atende:** a nota é trocada por 4,5 |

## Feed e métricas

| ID | Regra | Situação |
|---|---|---|
| RN07 | O feed não mostra títulos registrados, descartados ou na watchlist | Atende |
| RN11 | O grupo A/B alterna pela ordem de cadastro | Atende |
| RN12 | Taxa de aceitação = títulos aceitos (Quero ver ou Já vi) ÷ títulos exibidos, contando cada par usuário e título uma única vez e apenas títulos exibidos no feed | **Não atende:** repetir o feedback conta de novo, a taxa chega a passar de 100%, e aceite de título não exibido também conta |

## Catálogo

| ID | Regra | Situação |
|---|---|---|
| RN15 | O mesmo título vindo de origens diferentes não é duplicado (prioridade: TMDB, mock, manual) | Atende |
| RN16 | A busca ignora acentos | **Não atende:** "chefao" não encontra "Chefão" |

## Rastreabilidade

Os caminhos de código são relativos a `backend/app/`, e os de teste, a `backend/tests/`.

| ID | Código | Teste |
|---|---|---|
| RN01 | `routers/auth.py` | `test_auth.py` |
| RN02 | `schemas.py`, `auth.py` | Falta |
| RN03 | `schemas.py` | `test_diary_lists.py` |
| RN04 | `schemas.py` | Falta |
| RN05 | `crud.py` | Falta |
| RN06 | `crud.py` | Falta |
| RN07 | `services/recommender.py` | `test_recommendations.py` |
| RN08 | `routers/lists.py` | `test_auth.py`, `test_diary_lists.py` (renomear sem teste) |
| RN09 | `routers/lists.py`, `routers/diary.py` | `test_diary_lists.py` (diário sem teste) |
| RN10 | `auth.py` | `test_admin.py` |
| RN11 | `routers/auth.py` | `test_auth.py` |
| RN12 | `services/metrics.py` | Falta |
| RN13 | `routers/diary.py` | Falta |
| RN14 | `routers/auth.py` | Falta |
| RN15 | `services/catalog.py` | `test_tmdb_unit.py` |
| RN16 | `routers/media.py` | Falta |
