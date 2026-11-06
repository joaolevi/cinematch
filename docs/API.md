# API do Tastory — guia para quem vai fazer o frontend

- **Base URL (local):** `http://localhost:8000`
- **Documentação interativa:** `http://localhost:8000/docs` (Swagger, dá para testar todas as rotas)
- **Contrato OpenAPI:** [`openapi.json`](openapi.json). Serve para gerar clientes/tipos, ex.:
  `npx openapi-typescript docs/openapi.json -o src/api-types.ts`
- **CORS:** liberado por padrão para `localhost:5173` (Vite) e `localhost:3000` (Next/CRA).
  Outras origens vão em `TASTORY_CORS_ORIGINS` no `.env`.
- Erros vêm como `{"detail": "mensagem"}` (validação: `detail` é uma lista com `msg`).

## Autenticação

1. `POST /auth/register` `{name, email, password}` (senha de 6 caracteres a 72 bytes) ou `POST /auth/login` `{email, password}`
2. Resposta: `{access_token, token_type: "bearer", user: {id, name, email, role, ab_group, onboarded}}`
3. Envie em todas as rotas protegidas: `Authorization: Bearer <access_token>` (validade de 24 h)
4. `role == "admin"` libera as rotas `/admin/*`. Se `onboarded == false`, mostre o onboarding.

Contas de demonstração: `admin@tastory.dev / admin123`, `demo@tastory.dev / demo123`.

## Rotas

| Método e rota | Para quê | Corpo / parâmetros |
|---|---|---|
| `GET /me` | Usuário logado | — |
| `GET /me/preferences` | Gêneros escolhidos | — |
| `PUT /me/preferences` | Onboarding | `{genres: string[], decades: number[], creators: string[], liked_media_ids: number[]}` |
| `GET /media` | Busca/listagem | `q`, `type` (`movie`\|`series`), `genre`, `sort` (`popularity`\|`title`\|`year`), `limit`, `offset` → `{items, total}` |
| `GET /media/genres` | Lista de gêneros (para filtros/onboarding) | — |
| `GET /media/facets` | Décadas e criadores do catálogo, para o onboarding | `genre` (pode repetir), `limit` |
| `GET /media/trending` | Em alta (sem login) | `type`, `limit` |
| `GET /media/{id}` | Detalhe + média de notas + resenhas + `my_status` | — |
| `GET /diary` | Diário do usuário (mais recente primeiro) | — |
| `POST /diary` | "Já vi" | `{media_id, rating?: 0.5–5 (passo 0.5), review?, consumed_at?: "AAAA-MM-DD"}` |
| `PATCH /diary/{id}` · `DELETE /diary/{id}` | Editar / remover registro | `{rating?, review?, consumed_at?}` |
| `GET /lists` | Listas (a primeira é sempre a watchlist "Quero ver") | — |
| `POST /lists` · `PATCH /lists/{id}` · `DELETE /lists/{id}` | Criar / renomear / excluir | `{name}` |
| `POST /lists/{id}/items` · `DELETE /lists/{id}/items/{media_id}` | Adicionar / remover título | `{media_id}` |
| `GET /recommendations` | Feed "Para você" | `type`, `limit` → `{variant, strategy, items: [{media, score, reason, strategy}]}` |
| `POST /recommendations/{media_id}/feedback` | Botões do feed | `{action: "want"\|"seen"\|"dismiss", rating?, review?}` |
| `POST /admin/media` · `PATCH`/`DELETE /admin/media/{id}` | Gerenciar catálogo | campos de mídia |
| `POST /admin/sync` | Sincronizar catálogo externo | `provider` (`auto`\|`tmdb`\|`mock`), `pages` |
| `GET /admin/tmdb/search` | Buscar no TMDB | `q`, `type` → lista com `media_id` se já estiver no catálogo |
| `POST /admin/tmdb/import` | Importar um título do TMDB | `{type, tmdb_id}` |
| `POST /admin/tmdb/enrich` | Completar títulos sem pôster com dados do TMDB | → `{checked, enriched, not_found, conflicts}` |
| `GET /admin/reviews` · `PATCH /admin/reviews/{id}` | Moderação | `hidden`; corpo `{hidden: bool}` |
| `GET /admin/metrics` | Taxa de aceitação A/B | — |

## Objeto `Media`

```json
{
  "id": 7, "type": "movie", "source": "tmdb", "external_id": "movie-155",
  "title": "Batman: O Cavaleiro das Trevas", "year": 2008,
  "overview": "Batman enfrenta o Coringa...",
  "poster_url": "https://image.tmdb.org/t/p/w342/....jpg",
  "genres": ["Ação", "Crime", "Suspense"], "tags": ["joker", "superhero"],
  "creators": ["Christopher Nolan"], "popularity": 84.4
}
```

`poster_url` pode ser `null` (títulos do mock não enriquecidos ou sem pôster no TMDB): desenhe um
placeholder (ex.: gradiente com o título). Exibir dados do TMDB exige o crédito:
*"Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB."*

## Fluxo principal (Diagrama de Atividades)

1. Login → se `onboarded == false`, onboarding (`GET /media/genres` + `GET /media/trending` → `PUT /me/preferences`).
2. Feed: `GET /recommendations`. Mostre `reason` em cada card. `strategy == "trending"` indica *cold start*.
3. Botões do card → `POST /recommendations/{id}/feedback` e remova o card da tela.
   Itens registrados, descartados ou na watchlist não voltam ao feed.
