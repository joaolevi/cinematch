# Regras de negócio

> [Voltar ao índice](README.md) · A ligação com código e testes está no fim deste arquivo.

As regras RN02, RN12, RN13, RN14 e RN16 foram corrigidas em 06/11/2026 e estão na branch `homol`, que ainda não subiu para a `main`.
RN12, RN13 e RN14 foram aprovadas por Sophia (GP) em 05/11/2026.

## Conta e acesso

| ID | Regra | Situação |
|---|---|---|
| RN01 | O e-mail é único, sem diferenciar maiúsculas de minúsculas | Atende |
| RN02 | A senha tem de 6 caracteres a 72 bytes; fora disso a API devolve erro de validação (422) | Atende |
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
| RN13 | Resenha oculta continua oculta quando o autor a edita; só o admin restaura | Atende |
| RN14 | Refazer o onboarding não altera notas que já existem | Atende |

## Feed e métricas

| ID | Regra | Situação |
|---|---|---|
| RN07 | O feed não mostra títulos registrados, descartados ou na watchlist | Atende |
| RN11 | O grupo A/B alterna pela ordem de cadastro | Atende |
| RN12 | Taxa de aceitação = títulos aceitos (Quero ver ou Já vi) ÷ títulos exibidos, contando cada par usuário e título uma única vez e apenas títulos exibidos no feed. Um título conta como exibido quando pelo menos metade do card aparece na tela | Atende |

## Catálogo

| ID | Regra | Situação |
|---|---|---|
| RN15 | O mesmo título vindo de origens diferentes não é duplicado (prioridade: TMDB, mock, manual) | Atende |
| RN16 | A busca ignora acentos | Atende |
| RN19 | Títulos de anos futuros aparecem como "Em breve" e ficam no fim da ordem "Mais recentes" | Atende |

## Diário

| ID | Regra | Situação |
|---|---|---|
| RN17 | O top 10 dos mais amados usa notas a partir de 3,5, e o dos mais odiados, notas abaixo de 3. Assim, quem só dá notas altas não vê títulos bons entre os odiados | Atende |
| RN18 | Títulos marcados no onboarding entram no diário sem nota. Eles não contam nas médias nem no top 10, mas o recomendador os trata como "gostei", até a pessoa dar uma nota | Atende |

## Rastreabilidade

Os caminhos de código são relativos a `backend/app/`, e os de teste, a `backend/tests/`.

| ID | Código | Teste |
|---|---|---|
| RN01 | `routers/auth.py` | `test_auth.py` |
| RN02 | `schemas.py`, `auth.py` | `test_auth.py` |
| RN03 | `schemas.py` | `test_diary_lists.py` |
| RN04 | `schemas.py` | Falta |
| RN05 | `crud.py` | Falta |
| RN06 | `crud.py` | Falta |
| RN07 | `services/recommender.py` | `test_recommendations.py` |
| RN08 | `routers/lists.py` | `test_auth.py`, `test_diary_lists.py` (renomear sem teste) |
| RN09 | `routers/lists.py`, `routers/diary.py` | `test_diary_lists.py` (diário sem teste) |
| RN10 | `auth.py` | `test_admin.py` |
| RN11 | `routers/auth.py` | `test_auth.py` |
| RN12 | `services/metrics.py`, `routers/recommendations.py`, `frontend/src/impressions.tsx` | `test_admin.py`, `test_recommendations.py` |
| RN13 | `routers/diary.py` | `test_admin.py` |
| RN14 | `routers/auth.py`, `crud.py` | `test_diary_lists.py` |
| RN15 | `services/catalog.py` | `test_tmdb_unit.py` |
| RN16 | `routers/media.py`, `services/catalog.py` | `test_diary_lists.py` |
| RN17 | `frontend/src/pages/DiaryPage.tsx` | Sem teste automatizado; conferida no navegador |
| RN18 | `crud.py`, `services/recommender.py` | `test_recommendations.py` |
| RN19 | `routers/media.py`, `frontend/src/components/Poster.tsx` | `test_diary_lists.py` |
