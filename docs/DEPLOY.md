# Guia para o deploy

> Responsável: Vinicius. Parte do [MVP](MVP.md). Os requisitos estão em [nao-funcionais.md](requisitos/nao-funcionais.md) (RNF11 a RNF18).

**Antes de publicar:** cumpra o RNF12. Hoje a senha de admin está pública no repositório, então qualquer
pessoa conseguiria entrar como administrador.

Os pontos abaixo foram verificados em 05/11/2026 numa cópia local com PostgreSQL 14, exceto os da hospedagem.

## API

- **Banco:** incluir `psycopg[binary]` em `backend/requirements.txt`. Com o SQLAlchemy 2.1, uma URL
  `postgresql://` usa esse driver. Os 39 testes offline, o seed e o feed passaram assim, sem mudar o código.
- **Inicialização:** a partir de `backend/`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. A
  verificação de saúde é `/health`.
- **Memória:** a API usou cerca de 170 MB.
- **Versões:** fixar as versões em `requirements.txt` antes de publicar (RNF18). Sem isso, uma nova instalação pode trazer versões diferentes das testadas.

## Variáveis de ambiente

| Variável | Valor |
|---|---|
| `TASTORY_DATABASE_URL` | URL do PostgreSQL |
| `TASTORY_SECRET_KEY` | Valor novo, gerado com `openssl rand -hex 32` |
| `TASTORY_AUTO_SEED` | `false`, para evitar gravar a simulação A/B e as senhas públicas no primeiro início |
| `TASTORY_CORS_ORIGINS` | Endereço do front publicado, sem espaços |
| `TASTORY_TMDB_API_KEY` | Chave do TMDB; sem ela os títulos ficam sem pôster |
| `TASTORY_TMDB_SYNC_PAGES` | `10`, para ampliar o catálogo: até 200 filmes e 200 séries populares, além do mock |

## Carga inicial

Depois de cumprir o RNF12, rode uma única vez, apontando para o banco de produção:

```bash
python -m scripts.seed --no-sim --tmdb
```

**Esse comando apaga todas as tabelas**, então nunca o execute com usuários reais no banco. Como são cerca
de 5.800 comandos SQL, a carga não deve rodar na subida do servidor.

## Interface

O `demo-front` usa `VITE_API_URL` e precisa que a hospedagem redirecione as rotas para `index.html`. O front
oficial precisa confirmar o equivalente.

## Plano gratuito do Render, se for o escolhido

O serviço dorme após 15 minutos sem acesso e leva cerca de um minuto para acordar. O banco gratuito expira em
30 dias.
