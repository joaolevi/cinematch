# Guia para o deploy

> Responsável: Vinicius. Parte do [MVP](MVP.md). Os requisitos estão em [nao-funcionais.md](requisitos/nao-funcionais.md) (RNF11 a RNF19).

A publicação será no servidor do Vinicius, sem custo (decisão D12), com o arquivo `docker-compose.prod.yml`. Os passos
abaixo foram testados localmente em 06/11/2026, exceto o acesso externo.

Os comandos abaixo têm atalhos no `Makefile`: `make prod-up`, `make prod-logs`, `make prod-seed CONFIRMAR=sim`,
`make prod-movielens DATA=/caminho/ml-32m` e `make backup`.

## 1. Configurar

```bash
cp .env.production.example .env.production   # preencha todos os campos
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```

O sistema não sobe sem essas variáveis e, em produção, recusa o segredo e as senhas públicas do repositório. As portas
ficam acessíveis só dentro do servidor, e o `.env.production` não vai para o git.

Use uma [chave própria do TMDB](https://www.themoviedb.org/settings/api), que é gratuita. Envie a senha de admin só para a Sophia e o
Antonio, em mensagem privada.

Durante os testes, publique a branch `homol`. Na entrega, depois que ela subir para a `main`, publique a `main` e repita
o teste do fluxo completo.

## 2. Fazer a carga inicial

Rode uma única vez:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec api python -m scripts.seed --no-sim --no-synthetic --tmdb
```

**Esse comando apaga todas as tabelas**, então nunca o execute com usuários reais no banco. O `--no-sim` deixa o painel de
métricas vazio, e o `--no-synthetic` evita contas simuladas, para só aparecerem notas e resenhas de pessoas reais. Em teste, a carga levou cerca de 2 minutos e gerou cerca de 3.950 títulos, quase todos com pôster.

## 3. Carregar as recomendações de filmes

É o que mais melhora as sugestões, e deve ser ligado na publicação (D14). Baixe o [MovieLens 32M](https://grouplens.org/datasets/movielens/32m/), que
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

Depois, preencha `TASTORY_PUBLIC_URL` e `TASTORY_API_URL` com os endereços gerados e rode o `up --build -d` de novo.
O `TASTORY_PUBLIC_URL` também entra na prévia do link, a imagem que aparece ao mandar o endereço no WhatsApp. O
Funnel tem limite de banda, e a Tailscale recomenda não expor dados sensíveis, por isso aceite e-mail fictício no
teste interno (RNF10).

## 5. Fazer backup

Antes do teste interno e da entrega:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db pg_dump -U tastory tastory > backup-$(date +%F).sql
```

Para restaurar, deixe só o banco no ar. **O `down -v` apaga o banco atual.** Com a API no ar, ela cria as tabelas vazias
antes, e a restauração fica incompleta: em teste, voltaram os títulos e as contas, mas o diário e os eventos sumiram.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production down -v
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --wait db
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db psql -q -U tastory tastory < backup.sql
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Atualizar o sistema publicado

Para publicar uma nova versão, rode `git pull` e `make prod-up`. Os dados continuam no banco, desde que você não use `down -v`
nem `make prod-seed`.

O projeto não tem migrations. Ao subir, a API cria as tabelas que faltam, mas **não altera as que já existem**:

| Mudança no código | O que acontece | O que fazer |
|---|---|---|
| Nada nos modelos | Atualiza normalmente | Só publicar |
| Tabela nova | A API cria sozinha | Só publicar |
| Coluna nova em tabela existente | A API sobe, mas busca e feed dão erro 500 | Fazer backup, rodar o `ALTER TABLE` e publicar |

Exemplo de coluna nova, sempre com valor padrão, para a versão antiga continuar funcionando:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db psql -U tastory tastory -c "alter table media add column exemplo json not null default '[]'"
```

Depois da carga inicial, evite mudar `backend/app/models.py` até a entrega. Nunca use `make prod-seed` para resolver erro de
banco, porque ele apaga as contas e o histórico.

## Antes de apresentar

- Confirme se o processador do servidor é x86 ou ARM. As imagens são construídas no próprio servidor.
- Acesse a URL antes de começar. Queda de energia ou de internet derruba o sistema.
- Se o deploy falhar, siga o plano B abaixo.

## Apagar uma conta

Use para as contas de teste antes do teste interno e para quem pedir a exclusão. O diário, as listas e os eventos da pessoa saem junto.

O jeito mais simples é pela interface: entre como admin e use **Administração → Usuários → Apagar conta**. Contas de administração não saem por ali. Pelo servidor:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db psql -U tastory tastory -c "delete from users where email = 'pessoa@teste.com'"
```

## Plano B

Se a URL pública falhar, o sistema roda em uma máquina local, com o mesmo banco. Prepare tudo em 08/11, enquanto há internet. A
escolha entre deploy e execução local sai na manhã de segunda (09/11), com o Vinicius (D17).

**1. Gere uma cópia do banco.** No servidor, use o comando de backup da seção 5. Sem servidor, faça a carga das seções 2 e 3 em
qualquer máquina com a chave do TMDB. O arquivo tem e-mails e senhas criptografadas, então não o envie para o git nem para grupos.

**2. Prepare a máquina da demonstração, que é o notebook da Sophia.** Precisa de internet só nesta etapa, para baixar as imagens:

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
funcionaram sem a chave do TMDB e com as imagens bloqueadas no navegador. Também funcionou com o Wi-Fi desligado, no
notebook da Sophia.
