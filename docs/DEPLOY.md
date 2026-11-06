# Guia para o deploy

> Responsável: Vinicius. Parte do [MVP](MVP.md). Os requisitos estão em [nao-funcionais.md](requisitos/nao-funcionais.md) (RNF11 a RNF19).

**Antes de publicar:** defina `TASTORY_ENV=production` e as senhas abaixo. Com esse valor, a API não sobe usando o segredo
e as senhas públicas do repositório.

Os pontos abaixo foram verificados em 06/11/2026 em Docker com PostgreSQL 16, exceto os da hospedagem.

## API

- **Banco:** a API usa o driver `psycopg`, que aceita URLs `postgresql://`.
- **Inicialização:** a partir de `backend/`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. A
  verificação de saúde é `/health`.
- **Memória:** a API usou cerca de 230 MB com 504 títulos.
- **Versões:** fixar as versões em `requirements.txt` antes de publicar (RNF18). Sem isso, uma nova instalação pode trazer versões diferentes das testadas.

## Docker

O `docker-compose.yml` é só para uso local, porque as senhas dele não valem para produção. Para publicar, use os dois
`Dockerfile` e configure as variáveis abaixo na hospedagem:

- **API:** `backend/Dockerfile`, que usa a porta da variável `PORT`, quando ela existir.
- **Interface:** `frontend/Dockerfile`, com o argumento de build `VITE_API_URL` apontando para a API publicada.

## Branch publicada

Durante os testes, publique a `homol`. Na entrega, depois que ela subir para a `main`, aponte a hospedagem para a `main`
e repita o teste do fluxo completo.

## Variáveis de ambiente

| Variável | Valor |
|---|---|
| `TASTORY_ENV` | `production` |
| `TASTORY_DATABASE_URL` | URL do PostgreSQL |
| `TASTORY_SECRET_KEY` | Valor novo, gerado com `openssl rand -hex 32` |
| `TASTORY_ADMIN_PASSWORD`, `TASTORY_DEMO_PASSWORD`, `TASTORY_SYNTHETIC_PASSWORD` | Senhas novas, diferentes das do README |
| `TASTORY_AUTO_SEED` | `false`, para evitar gravar a simulação A/B e as senhas públicas no primeiro início |
| `TASTORY_CORS_ORIGINS` | Endereço do front publicado, sem espaços |
| `TASTORY_TMDB_API_KEY` | Chave do TMDB; sem ela os títulos ficam sem pôster |
| `TASTORY_TMDB_SYNC_PAGES` | `10`, para ampliar o catálogo. Em teste, gerou 504 títulos em 23 s, 498 deles com pôster |

## Carga inicial

Com as variáveis definidas, rode uma única vez, apontando para o banco de produção:

```bash
python -m scripts.seed --no-sim --tmdb
```

**Esse comando apaga todas as tabelas**, então nunca o execute com usuários reais no banco. Como são cerca
de 5.800 comandos SQL, a carga não deve rodar na subida do servidor.

## Interface

A interface usa `VITE_API_URL` e precisa que a hospedagem redirecione as rotas para `index.html`. Não defina
`VITE_SHOW_DEMO_ACCOUNTS` em produção: assim, os atalhos das contas de demonstração ficam escondidos.

## Servidor do Vinicius

A publicação será no servidor do Vinicius, sem custo (decisão D12). Pontos a resolver:

- **Configuração de produção:** o `docker-compose.yml` é local. O servidor precisa de uma versão com as variáveis acima, senha própria no PostgreSQL e `restart: unless-stopped`.
- **Acesso externo com HTTPS:** a interface e a API precisam de endereços públicos. Prefira um túnel, que não exige abrir portas no roteador.
- **Processador:** confirmar se é x86 ou ARM. As imagens podem ser construídas no próprio servidor.
- **Cópia do banco:** fazer backup antes da homologação e da entrega.
- **Plano B:** se o servidor cair, rodar `docker compose up --build` numa máquina local.
