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
métricas vazio, pronto para contar só interações reais. Em teste, a carga levou cerca de 1,5 minuto e gerou cerca de 3.950 títulos, quase todos com pôster.

## 3. Carregar as recomendações de filmes

Opcional, mas é o que mais melhora as sugestões. Baixe o [MovieLens 32M](https://grouplens.org/datasets/movielens/32m/), que
fica fora do repositório, e rode depois da carga inicial:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm -v /caminho/ml-32m:/data:ro api python -m scripts.import_movielens /data
```

Em teste, levou 31 s e gerou 71.835 vizinhos para 1.438 filmes. Depois, defina `TASTORY_USE_EXTERNAL_NEIGHBORS=true` no
`.env.production` e rode o `up -d` de novo. A licença não permite uso comercial sem permissão.

## 4. Abrir o acesso externo

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

## 5. Fazer backup

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
- Se o deploy falhar, siga o plano B abaixo.

## Apagar uma conta

Use para a conta de teste antes da homologação e para quem pedir a exclusão. O diário, as listas e os eventos da pessoa saem junto:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db psql -U tastory tastory -c "delete from users where email = 'pessoa@teste.com'"
```

## Plano B

Se a URL pública falhar, o sistema roda em uma máquina local, com o mesmo banco. Prepare tudo em 08/11, enquanto há internet.

**1. Gere uma cópia do banco.** No servidor, use o comando de backup da seção 5. Sem servidor, faça a carga das seções 2 e 3 em
qualquer máquina com a chave do TMDB. O arquivo tem e-mails e senhas criptografadas, então não o envie para o git nem para grupos.

**2. Prepare a máquina da demonstração.** Precisa de internet só nesta etapa, para baixar as imagens:

```bash
git clone https://github.com/joaolevi/cinematch.git && cd cinematch
git checkout homol
docker compose build
docker compose pull db
```

**3. Restaure o banco antes de subir a API.** Se a API subir antes, ela cria dados de exemplo no banco vazio:

```bash
docker compose up -d --wait db
docker compose exec -T db psql -q -U tastory tastory < backup.sql
```

**4. Suba o sistema**, sem a chave do TMDB, que não é usada no feed:

```bash
TASTORY_USE_EXTERNAL_NEIGHBORS=true docker compose up -d
```

A interface fica em http://localhost:5173. As senhas são as do banco copiado.

**Sem internet:** tudo funciona, menos a importação pelo TMDB. Os pôsteres não carregam, e a interface mostra um pôster gerado com
o título.

Testado em 06/11/2026: restaurar e subir levou 5 s, com a imagem já construída. Cadastro, onboarding, feed, Quero ver e painel
funcionaram sem a chave do TMDB e com as imagens bloqueadas no navegador. **Falta testar com o Wi-Fi desligado na máquina da
demonstração.**
