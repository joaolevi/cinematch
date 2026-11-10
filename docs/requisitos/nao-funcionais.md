# Requisitos não funcionais

> [Voltar ao índice](README.md) · A forma de verificar cada requisito está no fim deste arquivo.

A coluna Situação mostra o que foi verificado em 05 e 06/11/2026.

## Gerais

| ID | Requisito | Origem | Situação |
|---|---|---|---|
| RNF01 | Depois de clonar, subir a API com um único comando (`./dev.sh`), sem chave de API; depois da primeira instalação, funcionar sem internet | PLANO §11 | Atende: `dev.sh` e `demo.sh` testados, com o fluxo completo no navegador. É o plano B do deploy |
| RNF02 | A chave do TMDB fica só no `.env`, fora do git | CLAUDE.md | Atende: `.env` está no `.gitignore` |
| RNF03 | Senhas guardadas com bcrypt; rotas protegidas exigem JWT | PLANO §3 | Atende |
| RNF04 | Textos e documentação em português | CLAUDE.md | Atende: telas revisadas em 08/11. O aviso do TMDB na página Sobre fica em inglês, como o TMDB escreve |
| RNF05 | `docs/tecnico/openapi.json` reflete as rotas reais | CONTRIBUTING | Atende: as 41 rotas coincidem com a aplicação (regerado em 08/11) |
| RNF06 | Testes offline verdes, e toda rota tem teste | CLAUDE.md | Atende: 115 testes offline e 13 de integração passam em 08/11. As rotas novas de usuários na administração ganharam 6 testes |
| RNF07 | Compatível com Python 3.12+ | README | Rodou em 3.13.5; o CI e o Docker usam 3.12. As versões fixas do numpy e do scipy não instalam em Python mais antigo |
| RNF08 | A interface exibe o crédito do TMDB | `docs/tecnico/API.md` | Atende: o aviso e o logo estão na página Sobre e no rodapé da apresentação, como o TMDB exige |
| RNF09 | O feed responde em até 1 s na máquina da demo | Aprovado em 06/11 | Atende: cerca de 115 ms com 3.966 títulos, no Docker |
| RNF20 | O cadastro e a página Comunidade avisam que os registros ficam visíveis para quem tem conta | Decisão de 06/11 | Atende: o aviso também está na apresentação, em "Bom saber" |
| RNF21 | A página Comunidade responde em até 1 s e não faz uma consulta ao banco por item | Decisão de 06/11 | Atende: o número de consultas não cresce com os itens |
| RNF10 | Coletar só nome, e-mail e histórico; nos testes com pessoas, aceitar e-mail fictício e avisar que os dados ficam em um servidor externo | Aprovado em 06/11 | O aviso e o e-mail fictício estão no [roteiro do teste interno](../gestao/HOMOLOGACAO.md); falta aplicar no teste |

## Deploy

| ID | Requisito | Origem | Situação |
|---|---|---|---|
| RNF11 | API e interface publicadas em URL pública com HTTPS | Decisão de 05/11; [#21](https://github.com/joaolevi/cinematch/issues/21) | Parcial: publicado no servidor do Vinicius (D12) e usado na apresentação de 10/11, mas com acesso liberado só para um IP. Falta abrir a URL pública com HTTPS ([guia](../tecnico/DEPLOY.md#4-abrir-o-acesso-externo)) |
| RNF12 | Em produção não há credencial publicada: segredo JWT próprio e senhas fora do repositório | Deploy | Atende: com `TASTORY_ENV=production`, a API e o seed recusam o segredo e as senhas públicas |
| RNF13 | Os dados sobrevivem a reinícios, com PostgreSQL | [#21](https://github.com/joaolevi/cinematch/issues/21) | Atende localmente: roda em PostgreSQL 16 no Docker, e os dados continuam depois de reiniciar |
| RNF14 | Em produção, o painel conta só interações reais | Deploy | Atende: em produção o auto-seed fica desligado, e o `seed --no-sim` deixa o painel zerado. Ver o [guia de deploy](../tecnico/DEPLOY.md) |
| RNF15 | O CORS libera apenas a origem do front publicado | Deploy | Configurável por `TASTORY_CORS_ORIGINS` |
| RNF16 | Entrada acima do limite devolve erro de validação (422), não erro 500 | Revisão de 06/11 | Atende: conferido no PostgreSQL |
| RNF17 | Diário e listas não fazem uma consulta ao banco por item | Revisão de 06/11 | Atende: o número de consultas não cresce com os itens |
| RNF19 | O sistema sobe em Docker com um comando, com API, interface e PostgreSQL | Decisão de 06/11 | Atende localmente: fluxo completo testado no navegador, e os dados continuam depois de reiniciar |
| RNF18 | Dependências com versões fixas | Revisão de 06/11 | Atende: `requirements.txt` e `requirements-dev.txt` fixam as versões com `==`, e o `package-lock.json` fixa as do front |

## Futuros

Fora do MVP, na ordem de implementação. A visão geral por incremento está em [incrementos.md](incrementos.md), e o
número anterior de cada requisito, renumerado em 10/11/2026, aparece na coluna "Antes". Esforço: P até uma semana, M de 1
a 3 semanas, G várias semanas. Ao mudar a situação de um requisito, atualize também a linha dele em incrementos.md.

| ID | Requisito | Situação | Depende de | Esforço | Incremento | Antes |
|---|---|---|---|---|---|---|
| <a id="rnff01"></a>RNFF01 | Mudar o banco sem apagar dados, com migrações | Não atende: mudar o modelo exige recriar o banco | — | P | 2a | RNFF01 |
| <a id="rnff02"></a>RNFF02 | Respeitar os termos e as licenças das fontes: créditos ao TMDB, à JustWatch, ao Last.fm e ao MusicBrainz, fonte e licença registradas em cada dado, e nenhum dado do TMDB redistribuído | Não atende. Os termos do TMDB restringem o uso com aplicações de ML ou IA e limitam a 6 meses o tempo de guardar dados; o risco foi aceito para o uso acadêmico (ver Riscos no [MVP.md](../gestao/MVP.md)). Numa versão comercial, é preciso consultar o TMDB e trocar a fonte de conteúdo do recomendador pelo Wikidata. O Last.fm exige contato antes de qualquer uso | — | P | 2a | RNFF09 |
| <a id="rnff04"></a>RNFF04 | Contar a aceitação só quando ela vier até 7 dias depois de a sugestão aparecer | Não atende: Quero ver e Já vi pela página do título contam se o título foi exibido em qualquer momento antes | — | P | 2a | RNFF06 |
| <a id="rnff05"></a>RNFF05 | Limitar as tentativas de login | Não atende | — | P | 2a | RNFF03 |
| <a id="rnff12"></a>RNFF12 | Calcular o conteúdo das séries, da música e do grupo B por um grafo de gosto (títulos, gêneros, tags, décadas, pessoas e, depois, climas e pontes como nós), com passeio a partir do que a pessoa curtiu e o caminho mais forte como motivo | Não atende: hoje o conteúdo é TF-IDF. No EXP01, só com conteúdo, o grafo teve NDCG@20 de 0,058 contra 0,022 do TF-IDF. Ao trocar o grupo B, a contagem do A/B recomeça (D24) | EXP04 | M | 2a | novo |
| <a id="rnff03"></a>RNFF03 | Rodar em segundo plano, fora das requisições: sincronizar os catálogos, atualizar os dados do TMDB antes de 6 meses, calcular os vizinhos e as pontes entre mídias e montar o grafo de conteúdo | Não atende: a sincronização roda dentro da requisição. As pontes saem do QLever ou dos dumps do Wikidata e do MusicBrainz | RNFF01 | M | 2b | RNFF04, RNFF08 |
| <a id="rnff06"></a>RNFF06 | Usar dados reais na parte colaborativa: MovieLens nos filmes, rota de recomendações do TMDB nas séries e ListenBrainz na música | Parcial: os filmes usam o MovieLens 32M quando a opção está ligada; no servidor publicado, falta carregar. Séries e música ainda não têm fonte | RFF01 (música) | M | 2b | RNFF05 |
| <a id="rnff07"></a>RNFF07 | Manter o feed rápido com o catálogo grande, lendo vizinhos já calculados | Não atende: ver as [evidências de carga](../tecnico/AVALIACAO.md#carga-do-recomendador-atual). Entra quando o catálogo passar de 10 mil títulos | RNFF03 | M | 2b | RNFF02 |
| <a id="rnff08"></a>RNFF08 | Cumprir a LGPD: consentimento para os experimentos, política de privacidade e direitos sobre os dados | Não atende. Precisa estar pronto antes de abrir a beta | — | P a M | 3 | novo |
| <a id="rnff09"></a>RNFF09 | Ter um vocabulário de clima comum a filmes, séries e música: cerca de 20 a 25 rótulos em pt-BR, com as palavras-chave do TMDB e as tags de música ligadas a eles | Não atende | RNFF02 | M a G | 4 | RNFF07 |
| <a id="rnff10"></a>RNFF10 | Calcular os vizinhos de coocorrência sem que os títulos muito populares dominem (normalização por popularidade) | Não atende: hoje a similaridade colaborativa é o cosseno simples | RNFF06 | P a M | 5 | RNFF11 |
| <a id="rnff11"></a>RNFF11 | Aprender com as aceitações quanto pesa cada fonte, cada ponte e cada tipo de motivo, testando um pouco de cada um (explorar e aproveitar) | Não atende: os pesos são fixos no código. Usa os eventos de exibição e aceitação que já existem, guardando a probabilidade de cada escolha. Inspirado no BaRT, do Spotify. Até haver aceitações suficientes, os pesos ficam fixos | EXP03 | M | Depois | RNFF10 |

## Rastreabilidade

| ID | EAP | Como verificar |
|---|---|---|
| RNF01 | 4.3 | Rodar `./dev.sh` em um clone limpo, sem `.env`, e acessar `/health` |
| RNF02 | 4.3 | Confirmar que `git check-ignore .env` reconhece o arquivo |
| RNF03 | 3.2 | `test_auth.py` |
| RNF04 | 2.1 a 2.4, 4.3 | Revisar as telas e os documentos |
| RNF05 | 1.3 | Comparar as rotas da aplicação com `docs/tecnico/openapi.json` |
| RNF06 | 4.1 | `pytest -m "not integration"` e CI |
| RNF07 | 4.1 | CI com Python 3.12 |
| RNF08 | 2.4 | Conferir o crédito na interface |
| RNF09 | 4.1 | Medir `GET /recommendations` na máquina da demo |
| RNF10 | 4.2 | Conferir o aviso no roteiro de teste com pessoas |
| RNF11 | 4.3 | Abrir a API e a interface pela URL pública, com HTTPS |
| RNF12 | 4.3 | Confirmar que o login com as senhas do repositório falha em produção |
| RNF13 | 3.1, 4.3 | Reiniciar o serviço e confirmar que os dados continuam lá |
| RNF14 | 4.2, 4.3 | Confirmar que o painel começa sem interações antes de um teste com pessoas |
| RNF15 | 4.3 | Confirmar que o navegador bloqueia chamadas de outra origem |
| RNF16 | 3.2 | Enviar campos acima do limite no PostgreSQL e confirmar o erro 422 |
| RNF17 | 3.2 | Contar as consultas de `GET /diary` e `GET /lists` |
| RNF18 | 4.3 | Instalar em ambiente limpo e conferir as versões |
| RNF19 | 4.3 | Rodar `docker compose up --build` e testar o fluxo completo |
| RNF20 | 2.1, 2.3 | Conferir o aviso no cadastro e na Comunidade |
| RNF21 | 2.3 | `test_community.py` e medição na máquina da demo |
