# Plano de Implementação — Protótipo Tastory

> Baseado no pitch "CineMatch / Tastory — A história do seu gosto" (Gerência de Projeto 2026.2).
> Objetivo: um **protótipo utilizável** que implemente as *core functions* do Diagrama de Casos de Uso
> e o fluxo do Diagrama de Atividades, com interface web para interação. Não é produto final.
>
> **Decisões fechadas:** repositório público `joaolevi/cinematch` · catálogo **mockado** (sem TMDB real) ·
> execução **apenas local** (sem deploy) · **filmes e séries** neste incremento; álbuns ficam para depois.
>
> **Status (2026-11-05):** Estágios 1–3 implementados — backend, recomendador, frontend, admin, 25 testes e CI.

---

## 1. Entendimento do projeto

**Problema:** quem registra filmes, séries e álbuns em diários (ex.: Letterboxd) não recebe recomendações
a partir desse acervo; Netflix/Spotify recomendam, mas só dentro do próprio catálogo.

**Proposta:** um diário unificado das três mídias com **motor de recomendação híbrido**
(baseado em conteúdo + colaborativo). Os atributos dos títulos vêm de APIs externas (TMDB e MusicBrainz),
então a recomendação funciona desde o primeiro cadastro.

**Atores (DCU):**
- **Usuário** — cadastra-se, busca, registra consumo, avalia, organiza listas, vê/descarta recomendações.
- **Administrador** — herda tudo do Usuário + gerencia catálogo, modera avaliações, sincroniza catálogo externo.
- **Serviço de Recomendação** e **API de Catálogo Externo** — atores secundários acionados pelo sistema.

**Fluxo principal (DA):** login → onboarding opcional → "Ver Recomendações" → sistema verifica se há
histórico/preferências → **sim:** recomendador híbrido / **não:** mídias em alta (*cold start*) → feed
filtrado (sem descartados nem já registrados) → usuário escolhe **Quero ver** (watchlist), **Já vi**
(registra + nota opcional) ou **Não me interesso** (descarta) → interação persistida → ciclo se realimenta.

**Métrica de sucesso:** `taxa de aceitação = (Quero ver + Já vi) ÷ sugestões exibidas`, comparada via teste A/B.

**Escopo incremental do pitch:** filmes e séries primeiro; álbuns quando a ingestão musical estiver validada.

---

## 2. Escopo do protótipo

### Dentro do escopo (core)
| Pacote DCU | Caso de uso | Entrega no protótipo |
|---|---|---|
| Acesso | Cadastrar Conta, Fazer Login | Cadastro/login com e-mail + senha (JWT) |
| Acesso | Definir Preferências Iniciais | Onboarding: escolher gêneros + marcar títulos que já gosta |
| Uso Geral | Buscar Mídias | Busca por título/gênero no catálogo local |
| Uso Geral | Registrar Consumo / Avaliar Mídia | Diário: "Já vi" com data, nota 0,5–5 estrelas opcional e resenha curta |
| Uso Geral | Gerenciar Listas | Watchlist (lista padrão) + listas personalizadas (CRUD) |
| Uso Geral | Ver / Descartar Recomendação | Feed "Para você" com os 3 botões do DA |
| Inteligência | Gerar Recomendações | Motor híbrido (conteúdo + colaborativo) com fallback de populares |
| Administração | Gerenciar Catálogo | Listar, editar, remover títulos |
| Administração | Sincronizar Catálogo Externo | Botão "sincronizar" que importa títulos de uma **API externa mockada** (ver seção 7) |
| Administração | Moderar Avaliações | Ocultar/restaurar resenhas |
| Métrica | Taxa de aceitação + A/B | Registro de impressões e ações; painel admin com taxa por variante |

### Fora do escopo
Streaming de conteúdo, recursos sociais (seguir, comentar), recuperação de senha/verificação de e-mail,
app mobile nativo, treinamento de modelos de ML pesados, alta escalabilidade, **integração real com
TMDB/MusicBrainz**, **álbuns** (próximo incremento) e **deploy em nuvem**.

---

## 3. Arquitetura e stack

```
┌──────────────────────┐   REST/JSON   ┌───────────────────────────┐
│ Frontend (SPA)       │ ────────────▶ │ Backend API (FastAPI)     │
│ React + Vite + TS    │ ◀──────────── │  ├─ routers (auth, media, │
│ Tailwind CSS         │     JWT       │  │   diary, lists, recs,  │
└──────────────────────┘               │  │   admin)               │
                                       │  ├─ services/recommender  │
                                       │  └─ services/catalog      │──▶ CatalogProvider (interface)
                                       └────────────┬──────────────┘      └─ MockCatalogProvider
                                                    ▼                         (lê data/mock_external_catalog.json)
                                            SQLite (SQLAlchemy)
```

| Camada | Escolha | Por quê |
|---|---|---|
| Backend | **Python 3.12 + FastAPI** | Rápido de escrever, documentação Swagger automática (`/docs`) — ótimo para apresentar as APIs REST do pacote 3.2 |
| ORM / Banco | **SQLAlchemy + SQLite** | Relacional (pacote 3.1) sem precisar instalar servidor; trocar para PostgreSQL depois é só mudar a URL |
| Recomendação | **numpy + scikit-learn** (TF‑IDF, similaridade de cosseno) | Python é a linguagem natural para o motor; catálogo pequeno cabe em memória |
| Auth | JWT (`python-jose`) + bcrypt (`passlib`) | Simples e stateless |
| Frontend | **React + Vite + TypeScript + Tailwind** | Separação clara frontend/backend (pacotes 2.0 e 3.0 da EAP) permite dividir a equipe |
| Testes | `pytest` (backend), `vitest` opcional (frontend) | Pacote 4.1 |
| CI | GitHub Actions (lint + testes + build) | Garante que PRs dos colegas não quebrem o projeto |
| Execução | Local: `uvicorn` (API) + `npm run dev` (front), com script `make dev`/`dev.sh` | Sem deploy — basta rodar na máquina de cada aluno |

---

## 4. Modelo de dados

```
users            (id, name, email, password_hash, role[user|admin], ab_group[A|B], created_at)
user_preferences (user_id, genre)                                   -- onboarding
media            (id, type[movie|series], source[mock|manual], external_id,   -- 'album' entra no próximo incremento
                  title, year, overview, poster_url, genres[json], tags[json],
                  creators[json], popularity, created_at)
diary_entries    (id, user_id, media_id, consumed_at, rating[0.5–5|null], review, review_hidden, created_at)
lists            (id, user_id, name, is_watchlist, created_at)
list_items       (list_id, media_id, added_at)
rec_events       (id, user_id, media_id, action[shown|want|seen|dismiss], variant, score, created_at)
dismissed        (user_id, media_id)                                -- atalho para filtrar o feed
```

---

## 5. API REST (principais endpoints)

| Método | Rota | Caso de uso |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Cadastrar / Login |
| GET/PUT | `/me/preferences` | Preferências iniciais |
| GET | `/media?q=&type=` · `/media/{id}` | Buscar mídias / detalhe |
| GET | `/media/trending?type=` | Mídias em alta (cold start) |
| GET/POST/PATCH/DELETE | `/diary` · `/diary/{id}` | Registrar consumo / Avaliar |
| GET/POST/PATCH/DELETE | `/lists` · `/lists/{id}` · `/lists/{id}/items` | Gerenciar listas / watchlist |
| GET | `/recommendations?type=&limit=` | Ver recomendações (gera e registra impressões) |
| POST | `/recommendations/{media_id}/feedback` `{action: want\|seen\|dismiss, rating?}` | Quero ver / Já vi / Descartar |
| GET/POST/PATCH/DELETE | `/admin/media` | Gerenciar catálogo |
| POST | `/admin/sync` | Sincronizar catálogo externo (mock) |
| GET/PATCH | `/admin/reviews` | Moderar avaliações |
| GET | `/admin/metrics` | Taxa de aceitação geral e por variante A/B |

---

## 6. Motor de recomendação híbrido

1. **Vetor de item (conteúdo):** gêneros (one-hot) + tags/palavras-chave (TF‑IDF) + década + criadores
   (diretor/artista) + tipo de mídia.
2. **Perfil do usuário:** média ponderada dos vetores dos itens com que interagiu:
   nota → peso `(nota − 2,5)` · watchlist/lista → `+0,5` · descartado → `−1` · gêneros do onboarding → vetor inicial.
3. **Score de conteúdo:** similaridade de cosseno entre perfil e cada item candidato.
4. **Score colaborativo (item‑item):** matriz usuário × item com as interações; similaridade de cosseno entre
   itens; score = soma das similaridades com os itens bem avaliados pelo usuário
   ("usuários que gostaram de X também gostaram de Y").
5. **Híbrido:** `score = α·conteúdo + (1−α)·colaborativo`, com `α` alto quando há poucos dados na base
   (ex.: α = 0,8 com < 5 interações do usuário; 0,5 depois).
6. **Filtro:** remove descartados e já registrados; aplica leve diversidade (máx. N do mesmo gênero no topo).
7. **Cold start:** sem histórico nem preferências → `trending` (popularidade do catálogo + mais registrados na plataforma).
8. **Explicação:** cada card mostra "Porque você curtiu *Título X*" (item do histórico que mais contribuiu).
9. **A/B:** usuário recebe `ab_group` no cadastro — **A = híbrido**, **B = só conteúdo** (ou populares).
   `rec_events` registra cada `shown` e ação, e o painel admin calcula a taxa de aceitação por grupo.

Para o colaborativo ter dados na demo, o seed cria **~30 usuários sintéticos** com "personas" de gosto
(ex.: fã de terror, de animação, de ficção científica) que avaliam títulos coerentes com o perfil.

---

## 7. Catálogo externo (mockado)

O pitch prevê o TMDB (base pública de filmes/séries) como "API de Catálogo Externo". No protótipo ele é
**simulado**, mantendo o caso de uso e o ator secundário do DCU:

- `backend/data/seed_catalog.json` — 153 filmes e séries reais e conhecidos (título, ano, sinopse curta,
  gêneros, tags, diretor/criador, popularidade), carregados no banco pelo `seed.py`.
- `backend/data/mock_external_catalog.json` — mais 45 títulos que **não** estão no seed; o botão
  "Sincronizar" do admin os importa, simulando a ingestão externa.
- `CatalogProvider` é uma interface; o `MockCatalogProvider` lê os JSON. Trocar por um `TmdbProvider` real
  no futuro não exige mexer no resto do sistema.
- **Pôsteres:** gerados no frontend (gradiente com cor derivada do título + nome + ano), sem imagens externas.

---

## 8. Telas do frontend

1. **Login / Cadastro**
2. **Onboarding** — escolha de gêneros + grade de títulos populares para marcar "já gosto" (pulável)
3. **Para você (feed)** — cards com pôster, motivo da sugestão e botões **Quero ver · Já vi · Não me interesso**
   (Já vi abre modal com estrelas opcionais); abas Filmes / Séries
4. **Buscar** — busca com filtro por tipo
5. **Detalhe da mídia** — informações, média de notas, resenhas, botões de registrar/adicionar à lista
6. **Meu diário** — linha do tempo do que consumiu, com notas ("a história do seu gosto")
7. **Listas** — watchlist + listas personalizadas
8. **Admin** — abas Catálogo (CRUD + importar), Moderação (resenhas) e Métricas (taxa de aceitação A/B)

Identidade visual seguindo o pitch: fundo escuro `#0b0d10`, cards `#1f2630`, destaque ciano `#5ff5e8`.
Nome exibido no app: **CineMatch**.

---

## 9. Estrutura do repositório

```
cinematch/
├── backend/
│   ├── app/
│   │   ├── main.py  db.py  models.py  schemas.py  auth.py  config.py
│   │   ├── routers/   auth.py media.py diary.py lists.py recommendations.py admin.py
│   │   └── services/  recommender.py catalog.py metrics.py
│   ├── data/seed_catalog.json  mock_external_catalog.json
│   ├── scripts/seed.py            # catálogo + usuários sintéticos + admin padrão
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   └── src/ (pages/, components/, api/, hooks/)
├── docs/            # pitch, diagramas UML, EAP, RACI, este plano
├── .github/workflows/ci.yml
├── dev.sh           # sobe API + front localmente
├── .env.example
└── README.md        # como rodar, contas de demo, roteiro de apresentação
```

---

## 10. Etapas de execução (alinhadas aos estágios PRINCE2 do pitch)

### Estágio 1 — Iniciação
- **E1.1** Criar repositório **público** `joaolevi/cinematch` (`gh repo create cinematch --public`), README, `.gitignore`, licença MIT, `.env.example`.
- **E1.2** Estrutura de pastas backend/frontend, CI no GitHub Actions.
- **E1.3** Gestão no GitHub: **milestones** = Iniciação / Execução / Transição; **issues** = pacotes da EAP
  (2.1, 2.2, 2.3, 2.4, 3.1–3.4, 4.1, 4.2, 4.3-docs) + issue "Incremento 2: álbuns" no backlog, com labels `frontend`, `backend`, `recomendação`, `docs`;
  **GitHub Projects** (quadro Kanban). Isso também serve como evidência de gerência do projeto para a disciplina.
- **E1.4** Copiar pitch/diagramas para `docs/`.

### Estágio 2 — Execução
- **E2.1** Backend base: modelos, banco, auth JWT, papéis user/admin. *(EAP 3.1, 3.2)*
- **E2.2** Catálogo: JSON mockados, `MockCatalogProvider`, seed, busca e trending. *(EAP 3.3)*
- **E2.3** Diário, avaliações, listas e watchlist. *(EAP 2.2 / 3.2)*
- **E2.4** Motor de recomendação + endpoint de feedback + `rec_events`. *(EAP 3.4)*
- **E2.5** Endpoints admin: catálogo, sync, moderação, métricas. *(EAP 2.4)*
- **E2.6** Frontend: todas as telas da seção 8 integradas à API. *(EAP 2.1–2.4)*

### Estágio 3 — Transição
- **E3.1** Testes `pytest`: auth, diário, listas, filtro do feed, cold start, cálculo da taxa de aceitação. *(EAP 4.1)*
- **E3.2** Teste A/B simulado: script que roda os usuários sintéticos contra as variantes A e B e mostra
  a taxa de aceitação no painel. *(EAP 4.2)*
- **E3.3** README com instruções de execução local, contas demo (`admin@cinematch.dev`, `demo@cinematch.dev`)
  e roteiro de demo. *(EAP 4.3 — documentação; deploy fora do escopo)*

### Depois (quando você pedir)
- Adicionar colaboradores: `gh api -X PUT repos/joaolevi/cinematch/collaborators/<usuario> -f permission=push`
  (preciso dos **usernames do GitHub** de cada aluno; eles recebem um convite por e-mail para aceitar).

---

## 11. Critérios de aceite do protótipo

- [ ] Usuário novo se cadastra, faz login e vê feed **não vazio** imediatamente (cold start com populares).
- [ ] Após marcar 3–5 títulos no onboarding, o feed muda e mostra o motivo de cada sugestão.
- [ ] "Já vi" registra no diário com nota opcional; "Quero ver" adiciona à watchlist; "Não me interesso" remove do feed — e nenhum desses volta a aparecer.
- [ ] Busca encontra filmes e séries; listas podem ser criadas/editadas.
- [ ] Admin sincroniza o catálogo externo mockado, edita/remove do catálogo e oculta resenhas.
- [ ] Painel mostra taxa de aceitação total e por variante A/B.
- [ ] Projeto roda localmente com poucos comandos, sem chaves de API nem internet.
- [ ] CI verde no GitHub.

---

## 12. Sugestão de divisão para a equipe (RACI do pitch)

| Pacote | Sugestão de responsável (R) |
|---|---|
| 1.0 Engenharia & Design (UML, protótipo UI) | Analista/QA |
| 2.0 Frontend (telas) | 2 devs |
| 3.0 Backend & Dados (API, catálogo) | 2 devs |
| 3.4 Recomendação | 1 dev |
| 4.0 Qualidade & Implantação (testes, A/B, docs) | Analista/QA |
| Gerente (A em todos) | João Levi |

Eu implemento a base completa; cada aluno pode assumir issues de melhoria via branch + Pull Request.

---

## 13. Decisões tomadas (2026-11-05)

1. **Repositório:** `cinematch`, **público**.
2. **Catálogo:** mockado em JSON (sem TMDB real), atrás de uma interface substituível.
3. **Execução:** apenas local, sem deploy.
4. **Álbuns:** próximo incremento (fica como issue no backlog).
