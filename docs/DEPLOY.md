# Guia para o deploy

> Responsável: Vinicius. Parte do [MVP](MVP.md). Os requisitos estão em [nao-funcionais.md](requisitos/nao-funcionais.md) (RNF11 a RNF19).

A publicação será no servidor do Vinicius, sem custo (decisão D12), com o arquivo `docker-compose.prod.yml`. Os passos
abaixo foram testados localmente em 06/11/2026, exceto o acesso externo.

## 1. Configurar

```bash
cp .env.production.example .env.production   # preencha todos os campos
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```

O sistema não sobe sem essas variáveis e, em produção, recusa o segredo e as senhas públicas do repositório. As portas
ficam acessíveis só dentro do servidor, e o `.env.production` não vai para o git.

Durante os testes, publique a branch `homol`. Na entrega, depois que ela subir para a `main`, publique a `main` e repita
o teste do fluxo completo.

## 2. Fazer a carga inicial

Rode uma única vez:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api python -m scripts.seed --no-sim --tmdb
```

**Esse comando apaga todas as tabelas**, então nunca o execute com usuários reais no banco. O `--no-sim` deixa o painel de
métricas vazio, pronto para contar só interações reais. Em teste, a carga levou 23 s e gerou 504 títulos, 498 com pôster.

## 3. Abrir o acesso externo

Use o [Tailscale Funnel](https://tailscale.com/docs/features/tailscale-funnel), que dá HTTPS sem abrir portas no roteador e
sem comprar domínio. No servidor, com o Funnel habilitado na conta:

```bash
tailscale funnel --bg --https=443 localhost:8080    # interface
tailscale funnel --bg --https=8443 localhost:8000   # API
tailscale funnel status
```

Depois, preencha `TASTORY_PUBLIC_URL` e `TASTORY_API_URL` com os endereços gerados e rode o `up --build -d` de novo. O
Funnel tem limite de banda, e a Tailscale recomenda não expor dados sensíveis, por isso aceite e-mail fictício na
homologação (RNF10).

## 4. Fazer backup

Antes da homologação e da entrega:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db pg_dump -U tastory tastory > backup-$(date +%F).sql
```

Para restaurar, em um banco vazio:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db psql -U tastory tastory < backup.sql
```

## Antes de apresentar

- Confirme se o processador do servidor é x86 ou ARM. As imagens são construídas no próprio servidor.
- Acesse a URL antes de começar. Queda de energia ou de internet derruba o sistema.
- **Plano B:** rode `docker compose up --build` em uma máquina local.
