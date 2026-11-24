# API do Tastory — guia para quem vai fazer o frontend

- **O contrato é o Swagger:** `http://localhost:8000/docs`, gerado pelo próprio código, sempre igual ao que a API faz.
  O mesmo contrato fica em [`openapi.json`](openapi.json), regenerado com `make openapi` em todo PR que muda uma rota.
  Este guia só traz o que o Swagger não mostra bem: autenticação, o fluxo das telas e as regras de uso.
- **Base URL (local):** `http://localhost:8000`
- **Documentação interativa:** `http://localhost:8000/docs` (Swagger, dá para testar todas as rotas)
- **Contrato OpenAPI:** [`openapi.json`](openapi.json). Serve para gerar clientes/tipos, ex.:
  `npx openapi-typescript docs/tecnico/openapi.json -o src/api-types.ts`
- **CORS:** liberado por padrão para `localhost:5173` (Vite) e `localhost:3000` (Next/CRA).
  Outras origens vão em `TASTORY_CORS_ORIGINS` no `.env`.
- Erros vêm como `{"detail": "mensagem"}` (validação: `detail` é uma lista com `msg`).

## Autenticação

1. `POST /auth/register` `{name, email, password}` (senha de 6 caracteres a 72 bytes) ou `POST /auth/login` `{email, password}`
2. Resposta: `{access_token, token_type: "bearer", user: {id, name, email, role, ab_group, onboarded}}`
3. Envie em todas as rotas protegidas: `Authorization: Bearer <access_token>` (validade de 24 h)
4. `role == "admin"` libera as rotas `/admin/*`. Se `onboarded == false`, mostre o onboarding.

Contas de demonstração: `admin@tastory.dev / admin123`, `demo@tastory.dev / demo123`.

## Rotas do MVP (resumo)

Resumo das rotas entregues no MVP, com as regras de cada uma. As rotas novas da entrega final ficam só no
Swagger, com as regras na descrição de cada rota.

| Método e rota | Para quê | Corpo / parâmetros |
|---|---|---|
| `GET /me` | Usuário logado | — |
| `GET /me/preferences` | Preferências salvas | — → `{genres, decades, creators, onboarded}` |
| `PUT /me/preferences` | Onboarding | `{genres: string[], decades: number[], creators: string[], liked_media_ids: number[]}` |
| `GET /media` | Busca/listagem | `q`, `type` (`movie`\|`series`), `genre`, `person` (nome exato de diretor, criador ou ator), `sort` (`popularity`\|`title`\|`year`; em `popularity`, com `q`, os títulos que começam com o termo vêm primeiro; em `year`, títulos de anos futuros ficam no fim), `limit`, `offset` → `{items, total}` |
| `GET /media/genres` | Lista de gêneros (para filtros/onboarding) | — |
| `GET /media/facets` | Décadas e criadores do catálogo, para o onboarding | `genre` (pode repetir), `limit` |
| `GET /media/trending` | Em alta (sem login). Como o feed, só traz títulos do TMDB com sinopse, pôster e nome legível | `type`, `limit` |
| `GET /media/{id}/similar` | Títulos parecidos, do mesmo tipo, sem o que a pessoa já viu, descartou ou guardou | `limit` |
| `GET /media/{id}` | Detalhe + elenco (`actors`) + média de notas + resenhas + `my_status` | — |
| `GET /diary` | Diário do usuário (mais recente primeiro) | — |
| `POST /diary` | "Já vi". Sem `consumed_at`, o registro fica sem data | `{media_id, rating?: 0.5–5 (passo 0.5), review?, consumed_at?: "AAAA-MM-DD"}` |
| `PATCH /diary/{id}` · `DELETE /diary/{id}` | Editar / remover registro | `{rating?, review?, consumed_at?}` |
| `GET /lists` | Listas (a primeira é sempre a watchlist "Quero ver") | — |
| `GET /lists/{id}` | Uma lista, com os títulos | — |
| `POST /lists` · `PATCH /lists/{id}` · `DELETE /lists/{id}` | Criar / renomear / excluir | `{name}` |
| `POST /lists/{id}/items` · `DELETE /lists/{id}/items/{media_id}` | Adicionar / remover título | `{media_id}` |
| `GET /recommendations` | Feed "Para você" | `type`, `limit`, `exclude` (pode repetir: títulos que já foram mostrados, para trazer outros) → `{variant, strategy, items: [{media, score, reason, strategy}]}` |
| `POST /recommendations/{media_id}/feedback` | Botões do feed | `{action: "want"\|"seen"\|"dismiss", rating?, review?, consumed_at?}` |
| `POST /recommendations/impressions` | Avisa quais títulos do feed apareceram na tela. É isso que conta como exibido | `{items: [{media_id, strategy, score}]}` (até 100) |
| `DELETE /recommendations/{media_id}/feedback` | Desfazer o "Não me interesso" | — |
| `GET /community` | Página Comunidade: registros de "Já vi" de todas as pessoas, do mais recente ao mais antigo | `limit`, `before_id` (id do último item carregado) → `{items: [{id, user_name, media, rating, review, consumed_at, created_at}]}` |
| `GET /community/reviewers` | Quem mais escreve resenhas | `limit` → `[{name, titles, reviews}]` |
| `GET /health` | Confere se a API está no ar (sem login) | — |
| `POST /admin/media` · `PATCH`/`DELETE /admin/media/{id}` | Gerenciar catálogo | campos de mídia |
| `POST /admin/sync` | Sincronizar catálogo externo | `provider` (`auto`\|`tmdb`\|`mock`), `pages` |
| `GET /admin/tmdb/search` | Buscar no TMDB | `q`, `type` → lista com `media_id` se já estiver no catálogo |
| `POST /admin/tmdb/import` | Importar um título do TMDB | `{type, tmdb_id}` |
| `POST /admin/tmdb/enrich` | Completar títulos sem pôster com dados do TMDB | → `{checked, enriched, not_found, merged}` |
| `GET /admin/reviews` · `PATCH /admin/reviews/{id}` | Moderação | `hidden`; corpo `{hidden: bool}` |
| `GET /admin/metrics` | Taxa de aceitação A/B | — |
| `GET /admin/users` | Pessoas cadastradas, das mais recentes às mais antigas, com o que cada uma fez | `q` (nome ou e-mail), `kind` (`real` padrão \| `simulated` \| `all`), `limit`, `offset` → `{items: [{id, name, email, role, ab_group, is_synthetic, onboarded, created_at, diary_entries, reviews, shown, accepted, last_active}], total}` |
| `DELETE /admin/users/{id}` | Apaga a conta e tudo o que é dela (diário, listas, preferências e eventos) | 204; 400 para contas de administração; 404 se não existir |

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

**Álbuns** (`type: "album"`, `source: "musicbrainz"`) usam o mesmo objeto (D27):

- `creators` traz os artistas; `genres`, o gênero amplo em português ("MPB", "Trilha sonora"); `tags`, os gêneros finos
  do MusicBrainz ("tropicália").
- A capa (`poster_url`) é quadrada e vem do Cover Art Archive.
- `language` é o idioma das letras; um álbum instrumental vem com `null` e a tag `instrumental`.
- `links` traz onde ouvir. Com `level: "artist"`, o link leva à página do artista, porque o disco não tem link próprio
  naquele serviço: mostre como "Ouvir o artista no Spotify".
- `/media/genres` e `/media/facets` trazem só filmes e séries; para os gêneros e artistas de música, use `type=album`.
- Os álbuns ainda não aparecem no feed nem no "Em alta": entram com o feed misto (RFF27).
- Os dados vêm do MusicBrainz (CC0) e do ListenBrainz. O crédito "Dados de álbuns: MusicBrainz" é recomendado, e não
  exigido.

## Fluxo principal (Diagrama de Atividades)

1. Login → se `onboarded == false`, onboarding: gêneros (`GET /media/genres`), épocas e criadores (`GET /media/facets`), títulos (`GET /media` ou, sem escolhas, `GET /media/trending`) → `PUT /me/preferences`.
2. Feed: `GET /recommendations`. Mostre `reason` em cada card. `strategy == "trending"` indica *cold start*. Para mais sugestões (botão "Ver mais sugestões"), peça de novo com `exclude`; lista vazia indica que acabou. Quando metade de um card ficar 1 segundo na tela, avise em `POST /recommendations/impressions`, antes de enviar a reação a ele.
3. Botões do card → `POST /recommendations/{id}/feedback` e remova o card da tela.
   Itens registrados, descartados ou na watchlist não voltam ao feed.
