# CineMatch — Frontend

Frontend em React + Vite + TypeScript que consome a API do CineMatch (`docs/API.md` do repositório do backend).

## Como rodar

1. Suba a API (na raiz do repositório do backend): `./dev.sh` → http://localhost:8000
2. Neste diretório:

```bash
cp .env.example .env     # ajuste VITE_API_URL se a API não estiver em localhost:8000
npm install
npm run dev              # http://localhost:5173 (já liberado no CORS da API)
```

Contas de demonstração: `demo@cinematch.dev / demo123` (cai no cold start) e `admin@cinematch.dev / admin123`.

## Telas

| Rota | O que faz |
|------|-----------|
| `/login`, `/cadastro` | `POST /auth/login`, `POST /auth/register` |
| `/onboarding` | Gêneros + títulos em alta → `PUT /me/preferences` (só se `onboarded == false`) |
| `/` | Feed "Para você" (`GET /recommendations`), com motivo, Quero ver / Já vi / Descartar |
| `/buscar` | `GET /media` com filtros de tipo, gênero e ordenação, paginado |
| `/titulo/:id` | Detalhe, registrar no diário, adicionar a lista |
| `/diario` | Listar, editar e remover registros |
| `/listas` | Watchlist + listas próprias |

## Estrutura

- `src/api/client.ts`: cliente `fetch` com `Authorization: Bearer`, tratamento de erros (`detail`) e logout automático em 401
- `src/api/types.ts`: tipos escritos a partir do guia. Para tipos fiéis ao contrato: `npm run gen:types` (usa `../docs/openapi.json`)
- `src/auth/AuthContext.tsx`: sessão e token (localStorage)

## Pontos a conferir

O guia da API não detalha o formato exato de alguns campos, então confira no Swagger (`/docs`) e ajuste `types.ts` se preciso:

- `GET /media/{id}`: campos `average_rating`, `reviews` e `my_status`
- `GET /diary`: se cada entrada traz o objeto `media` completo
- `GET /lists`: se cada lista já traz `items` com as mídias

O painel admin (`/admin/*`) não está incluído nesta entrega.

O crédito do TMDB é exibido no rodapé, conforme exigido pela API.
