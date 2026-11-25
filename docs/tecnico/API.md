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

1. `POST /auth/register` `{name, email, password}` (senha de 6 caracteres a 72 bytes) ou `POST /auth/login` `{email, password}` (depois de 5 senhas erradas para o mesmo e-mail em 15 minutos, o login responde 429 com `Retry-After`)
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
| `GET /me/export` | Baixar os próprios dados (RFF06) | → JSON com `account`, `preferences`, `diary`, `lists`, `dismissed`, `following`, `review_comments`, `taste_adjustments` e `recommendation_events`; a senha não vai |
| `DELETE /me` | Excluir a própria conta e tudo o que é dela (RFF06) | `{password}` → 204; 403 com senha errada; 400 para contas de administração |
| `PUT /me/experiments` | Sair ou voltar para os experimentos (RFF17) | `{in_experiments: bool}` → o usuário. Fora deles, `variant` no feed vem `"-"` e as reações ficam fora da comparação A/B |
| `PUT /me/visibility` | Quem vê os meus registros (RFF10) | `{visibility: "all"\|"followers"\|"private"}` → o usuário. Vale na Comunidade, nas resenhas, no perfil e no "Para ver ou ouvir junto" |
| `PUT /me/services` | Os serviços que eu assino (RFF21) | `{services: ["netflix", ...]}`, com as chaves de `GET /media/services` → o usuário; 422 para chave desconhecida |
| `GET /me/taste` | O que o Tastory acha do gosto (RFF07) | → `{genres, decades, people, moods: [{kind, value, label, share, weight}], titles, excluded, adjusted}` |
| `PUT /me/taste/adjustments` | Pedir mais ou menos de algo (RFF07, RFF08) | `{kind: "genre"\|"decade"\|"person"\|"mood"\|"title", value, weight}`: 1,5 mais, 0,5 menos, 0 tira do cálculo, 1 volta ao normal → 204 |
| `DELETE /me/taste/adjustments` | Desfazer todos os ajustes | 204 |
| `GET /me/preferences` | Preferências salvas | — → `{genres, decades, creators, artists, onboarded}` |
| `PUT /me/preferences` | Onboarding | `{genres: string[], decades: number[], creators: string[], artists: string[], liked_media_ids: number[]}`. `genres` junta os gêneros de filme e de música; `artists` são os artistas de música |
| `GET /media` | Busca/listagem | `q`, `type` (`movie`\|`series`), `genre`, `person` (nome exato de diretor, criador ou ator), `sort` (`popularity`\|`title`\|`year`; em `popularity`, com `q`, os títulos que começam com o termo vêm primeiro; em `year`, títulos de anos futuros ficam no fim), `limit`, `offset` → `{items, total}` |
| `GET /media/services` | Serviços de streaming que dá para marcar (RFF21), com quantos títulos do catálogo estão em cada um | → `[{key, label, count}]` |
| `GET /media/occasions` | Ocasiões do momento (RFF20) | → `[{key, label}]`: `a-dois`, `amigos`, `familia` |
| `GET /external/search` | Buscar fora do catálogo (RFF13) | `q`, `type` (`video` = TMDB \| `album` = MusicBrainz) → lista com `media_id` se já estiver no catálogo |
| `POST /external/import` | Trazer um título para o catálogo (RFF13) | `{external_id}` da busca → 201 com o título; 200 se já estava (não gasta o limite); 429 depois de 10 em 24 horas |
| `GET /media/genres` | Lista de gêneros (para filtros/onboarding) | — |
| `GET /media/facets` | Décadas e criadores do catálogo, para o onboarding | `genre` (pode repetir), `limit` |
| `GET /media/trending` | Em alta (sem login). Como o feed, só traz títulos do TMDB com sinopse, pôster e nome legível | `type`, `limit` |
| `GET /media/{id}/similar` | Títulos parecidos, do mesmo tipo, sem o que a pessoa já viu, descartou ou guardou | `limit` |
| `GET /media/{id}` | Detalhe + elenco (`actors`) + média de notas + resenhas + `my_status` + `credit` (a fonte dos dados, com link e licença, RNFF02). As resenhas respeitam quem cada pessoa deixa ver (RFF10) | — |
| `GET /diary` | Diário do usuário (mais recente primeiro) | — |
| `POST /diary` | "Já vi". Sem `consumed_at`, o registro fica sem data | `{media_id, rating?: 0.5–5 (passo 0.5), review?, consumed_at?: "AAAA-MM-DD"}` |
| `PATCH /diary/{id}` · `DELETE /diary/{id}` | Editar / remover registro | `{rating?, review?, consumed_at?}` |
| `GET /lists` | Listas (a primeira é sempre a watchlist "Quero ver") | — |
| `GET /lists/{id}` | Uma lista, com os títulos | — |
| `POST /lists` · `PATCH /lists/{id}` · `DELETE /lists/{id}` | Criar / renomear / excluir | `{name}` |
| `POST /lists/{id}/items` · `DELETE /lists/{id}/items/{media_id}` | Adicionar / remover título | `{media_id}` |
| `GET /recommendations` | Feed "Para você" | `type`, `limit`, `exclude` (pode repetir: títulos que já foram mostrados, para trazer outros), `mood`, `max_minutes`, `occasion`, `only_mine` (só nos serviços da pessoa) → `{variant, strategy, items: [{media, score, reason, strategy, because, services}]}`. `services` traz os serviços da pessoa onde o título está |
| `GET /recommendations/watchlist` | O Quero ver ordenado pelo que combina agora (RFF22) | `mood`, `max_minutes`, `occasion`, `only_mine` → `{items, later}`: o que cabe no momento, do que mais combina ao que menos, e o resto |
| `GET /recommendations/pairs` | Sessão dupla (RFF27): um filme ou série sugerido e um disco ligado por ponte forte | `limit` (até 10), `exclude` (repete: filmes que já estão na tela), `mood`, `max_minutes`, `occasion`, `only_mine` → `[{video: {media, score, reason, strategy, because, services}, album, kind, reason}]`. `kind` é `soundtrack`, `composer`, `same_person`, `biopic` ou `documentary`. Não entra na comparação A/B |
| `GET /recommendations/together` | Para ver ou ouvir junto com uma a quatro pessoas, no momento (RFF28, RFF20) | `with` (repete: o id de cada pessoa), `limit`, `mood`, `max_minutes`, `occasion`, `only_mine` (os serviços de quem pede) → `[{media, score, reason, strategy, because, services}]`: primeiro o que aparece para todas, e o motivo mostra cada lado. 422 sem ninguém ou com mais de quatro; 404 para perfil privado ou o próprio; 403 quando a pessoa só mostra para quem segue e quem pede não segue |
| `POST /recommendations/{media_id}/feedback` | Botões do feed | `{action: "want"\|"seen"\|"dismiss", rating?, review?, consumed_at?}` |
| `POST /recommendations/impressions` | Avisa quais títulos do feed apareceram na tela. É isso que conta como exibido | `{items: [{media_id, strategy, score}]}` (até 100) |
| `DELETE /recommendations/{media_id}/feedback` | Desfazer o "Não me interesso" | — |
| `GET /community` | Página Comunidade: registros de "Já vi" de todas as pessoas, do mais recente ao mais antigo | `limit`, `before_id` (id do último item carregado), `following=true` (só de quem eu sigo) → `{items: [{id, user_id, user_name, media, rating, review, consumed_at, created_at, likes, liked, comments}]}` |
| `GET /community/reviewers` | Resenhas mais curtidas: quem escreve, pelas curtidas recebidas (RFF30), entre quem tem resenha | `limit` → `[{id, name, titles, reviews, likes}]` |
| `PUT /community/{entry_id}/like` · `DELETE /community/{entry_id}/like` | Curtir ou tirar a curtida de uma resenha (RFF30) | 204; repetir não muda nada; 400 para a própria resenha; 404 para resenha que quem vê não pode ver, oculta ou registro sem texto |
| `GET /community/{entry_id}/comments` · `POST /community/{entry_id}/comments` | Comentários de uma resenha (RFF30), do mais antigo ao mais novo | corpo `{text}`, até 500 caracteres → `{id, user_id, user_name, text, created_at, can_delete}`; 201 ao comentar |
| `DELETE /community/comments/{id}` | Apagar um comentário | 204; só quem escreveu o comentário ou a resenha (senão 403) |
| `GET /users/{id}` | Perfil de uma pessoa, com a compatibilidade de gosto | → `{id, name, is_me, counts, favorites, recent, compatibility, following, followers, follows, restricted}`; 404 para perfil privado; `restricted` quando a pessoa só mostra para quem segue e quem vê não segue, e aí os registros vêm vazios |
| `PUT /users/{id}/follow` | Seguir a pessoa (RFF09), sem pedido de aceite | 204; repetir não muda nada; 400 para o próprio perfil; 404 para perfil privado |
| `DELETE /users/{id}/follow` | Deixar de seguir | 204, mesmo se não seguia |
| `GET /users/following` | Quem eu sigo, por nome | → `[{id, name}]` |
| `GET /users/{id}/followers` · `GET /users/{id}/follows` | Quem segue a pessoa e quem ela segue (RFF09) | → `[{id, name}]`; perfis privados ficam de fora, como nos números do perfil; 404 para perfil privado |
| `GET /health` | Confere se a API está no ar (sem login) | — |
| `POST /admin/media` · `PATCH`/`DELETE /admin/media/{id}` | Gerenciar catálogo | campos de mídia |
| `POST /admin/sync` | Sincronizar catálogo externo | `provider` (`auto`\|`tmdb`\|`mock`), `pages` |
| `GET /admin/tmdb/search` | Buscar no TMDB | `q`, `type` → lista com `media_id` se já estiver no catálogo |
| `POST /admin/tmdb/import` | Importar um título do TMDB | `{type, tmdb_id}` |
| `POST /admin/tmdb/enrich` | Completar títulos sem pôster com dados do TMDB | → `{checked, enriched, not_found, merged}` |
| `GET /admin/reviews` · `PATCH /admin/reviews/{id}` | Moderação | `hidden`; corpo `{hidden: bool}` |
| `GET /admin/comments` · `PATCH /admin/comments/{id}` | Moderação dos comentários nas resenhas (RFF30) | `hidden`; corpo `{hidden: bool}` → `{id, user_name, user_email, entry_id, review_author, media_title, text, hidden, created_at}` |
| `GET /admin/metrics` | Taxa de aceitação A/B | → inclui `by_bridge: [{kind, label, shown, accepted, acceptance_rate}]`, a aceitação dos discos sugeridos por tipo de ponte (EXP03) |
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
- **Feed misto (RFF27):** sem `type`, `GET /recommendations` traz os filmes e séries de sempre e, no 3º, 7º, 11º…
  lugar, álbuns com motivo: ligados por uma ponte ao que a pessoa curtiu (`strategy: "bridge"`, com a ponte no
  `reason`) ou de artistas e gêneros escolhidos no onboarding (`strategy: "content"`). Com `type=album`, só álbuns, no
  máximo 2 do mesmo artista no começo da lista. Com `discovery`, parte dos álbuns é de gêneros que a pessoa ainda não
  ouve (`strategy: "discovery"`): 3 de cada 10 em `beyond` e 7 de cada 10 em `outside`. Avise as impressões dos álbuns
  como as dos filmes.
- **Climas (RNFF09, RFF23):** `GET /media/moods` traz os 20 climas `[{key, label, count}]`; cada mídia traz `moods`
  (as chaves). `GET /media?mood=leve` busca filmes, séries e álbuns juntos por clima.
- **Momento (RFF20):** `GET /recommendations` aceita `mood` e `max_minutes` (na série, a duração do episódio; títulos
  sem duração ficam de fora quando há limite).
- **Não por esse motivo (RFF08):** cada sugestão traz `because: {kind, value, label}`, o que está por trás do motivo.
  Para "Não por causa de Matrix", mande `PUT /me/taste/adjustments` com esse `kind` e `value` e `weight: 0.5`.
- **Registro que não conta (RFF07):** `PATCH /diary/{id}` com `{excluded: true}` tira o registro do cálculo do gosto,
  sem tirar do diário.
- **Pontes no detalhe (RFF26):** `GET /media/{id}/connections` traz os títulos da outra mídia ligados a este, com
  `reason` já escrito para o detalhe. Num filme ou série, mostre como "Para ouvir depois"; num álbum, "Para ver depois".
  O `kind` pode ser `soundtrack`, `composer`, `same_person`, `biopic`, `documentary`, `artist` ou `weak`.
- Os dados vêm do MusicBrainz (CC0) e do ListenBrainz. O crédito "Dados de álbuns: MusicBrainz" é recomendado, e não
  exigido.

## Fluxo principal (Diagrama de Atividades)

1. Login → se `onboarded == false`, onboarding: gêneros (`GET /media/genres`), épocas e criadores (`GET /media/facets`), títulos (`GET /media` ou, sem escolhas, `GET /media/trending`) → `PUT /me/preferences`.
2. Feed: `GET /recommendations`. Mostre `reason` em cada card. `strategy == "trending"` indica *cold start*. Para mais sugestões (botão "Ver mais sugestões"), peça de novo com `exclude`; lista vazia indica que acabou. Quando metade de um card ficar 1 segundo na tela, avise em `POST /recommendations/impressions`, antes de enviar a reação a ele.
3. Botões do card → `POST /recommendations/{id}/feedback` e remova o card da tela.
   Itens registrados, descartados ou na watchlist não voltam ao feed.
