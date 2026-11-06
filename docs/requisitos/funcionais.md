# Requisitos funcionais

> [Voltar ao índice](README.md) · A ligação com código e testes está no fim deste arquivo.

Quatro requisitos estão parciais porque dependem de [regras](regras-de-negocio.md) ainda não cumpridas, e a
interface depende da decisão [D2](../MVP.md#decisões).

## Acesso

| ID | Requisito | Situação | MVP |
|---|---|---|---|
| RF01 | Cadastrar conta com nome, e-mail e senha | Parcial (RN02) | Deve |
| RF02 | Entrar com e-mail e senha e receber um token válido por 24 h | Atende | Deve |
| RF03 | Escolher gêneros e títulos favoritos em um onboarding opcional | Parcial (RN14) | Deve |

## Uso geral

| ID | Requisito | Situação | MVP |
|---|---|---|---|
| RF04 | Buscar por título, criador ou tag, filtrar por tipo e gênero e ordenar | Atende | Deve |
| RF05 | Ver o detalhe de um título: dados, nota média, resenhas e status do usuário | Atende | Deve |
| RF06 | Registrar que viu um título, com data, e editar ou apagar o registro | Atende | Deve |
| RF07 | Dar nota e escrever resenha, ambas opcionais | Atende | Deve |
| RF08 | Criar, renomear e excluir listas, incluir e remover títulos e usar a watchlist "Quero ver" | Atende | Deve |
| RF09 | Ver o feed "Para você", com filtro por tipo | Atende | Deve |
| RF10 | Reagir a uma sugestão com Quero ver, Já vi ou Não me interesso | Atende | Deve |

## Inteligência

| ID | Requisito | Situação | MVP |
|---|---|---|---|
| RF11 | Gerar sugestões a partir do histórico e das preferências (grupo A: híbrido; grupo B: só conteúdo) | Atende | Deve |
| RF12 | Mostrar títulos em alta para quem não tem histórico nem preferências | Atende | Deve |
| RF13 | Mostrar em cada sugestão um motivo em texto, como um título do histórico, um gênero preferido ou "Em alta" | Atende | Deve |

## Administração

| ID | Requisito | Situação | MVP |
|---|---|---|---|
| RF14 | Admin cria, edita e remove títulos | Atende | Deve |
| RF15a | Admin sincroniza o catálogo mockado, sem internet | Atende | Deve |
| RF15b | Admin sincroniza, busca e importa títulos do TMDB real | Atende com TMDB simulado; os prints do projeto mostram uso real, mas os testes de integração não rodaram nesta revisão (sem chave) | Deve |
| RF16 | Admin lista, oculta e restaura resenhas | Parcial (RN13) | Deve |
| RF17 | Admin vê a taxa de aceitação geral e por grupo A/B | Parcial (RN12) | Deve |

## Interface

| ID | Requisito | Situação | MVP |
|---|---|---|---|
| RF18 | Interface web para os fluxos acima | A definir (D2) | Deve |

## Rastreabilidade

Os caminhos de código são relativos a `backend/app/`, e os de teste, a `backend/tests/`.

| ID | Origem | EAP | Código | Testes |
|---|---|---|---|---|
| RF01 | DCU: Cadastrar Conta | 2.1, 3.2 | `routers/auth.py` | `test_auth.py` |
| RF02 | DCU: Fazer Login | 2.1, 3.2 | `routers/auth.py`, `auth.py` | `test_auth.py` |
| RF03 | DCU: Definir Preferências Iniciais | 2.1 | `routers/auth.py` | `test_recommendations.py` |
| RF04 | DCU: Buscar Mídias | 2.3 | `routers/media.py` | `test_diary_lists.py` (gênero e ordenação sem teste) |
| RF05 | PLANO §8 | 2.3 | `routers/media.py` | `test_diary_lists.py` |
| RF06 | DCU: Registrar Consumo | 2.2 | `routers/diary.py`, `crud.py` | `test_diary_lists.py` |
| RF07 | DCU: Avaliar Mídia | 2.2 | `routers/diary.py` | `test_diary_lists.py` |
| RF08 | DCU: Gerenciar Listas | 2.2 | `routers/lists.py` | `test_diary_lists.py` |
| RF09 | DCU: Ver Recomendações | 2.3 | `routers/recommendations.py` | `test_recommendations.py` |
| RF10 | DCU: Descartar Recomendação; DA | 2.3 | `routers/recommendations.py` | `test_recommendations.py` |
| RF11 | DCU: Gerar Recomendações | 3.4 | `services/recommender.py` | `test_recommendations.py` |
| RF12 | DA: cold start | 3.4 | `services/recommender.py` | `test_recommendations.py` |
| RF13 | PLANO §6 | 3.4 | `services/recommender.py` | `test_recommendations.py` (só verifica que o motivo existe) |
| RF14 | DCU: Gerenciar Catálogo | 2.4 | `routers/admin.py` | `test_admin.py` |
| RF15a | DCU: Sincronizar Catálogo Externo | 3.3 | `services/catalog.py` | `test_admin.py` |
| RF15b | DCU: Sincronizar Catálogo Externo | 3.3 | `services/tmdb.py` | `test_tmdb_unit.py`, `integration/` |
| RF16 | DCU: Moderar Avaliações | 2.4 | `routers/admin.py` | `test_admin.py` |
| RF17 | Pitch; PLANO §2 | 4.2 | `services/metrics.py` | `test_admin.py` |
| RF18 | EAP 2.0 | 2.1 a 2.4 | Front oficial (fora do repositório) ou `demo-front/` | Sem testes; `demo-front` compila |
