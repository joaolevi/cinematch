# Requisitos não funcionais

> [Voltar ao índice](README.md) · A forma de verificar cada requisito está no fim deste arquivo.

A coluna Situação mostra o que foi verificado em 05 e 06/11/2026.

## Gerais

| ID | Requisito | Origem | Situação |
|---|---|---|---|
| RNF01 | Depois de clonar, subir a API com um único comando (`./dev.sh`), sem chave de API; depois da primeira instalação, funcionar sem internet | PLANO §11 | Atende: `dev.sh` e `demo.sh` testados, com o fluxo completo no navegador. É o plano B do deploy |
| RNF02 | A chave do TMDB fica só no `.env`, fora do git | CLAUDE.md | Atende: `.env` está no `.gitignore` |
| RNF03 | Senhas guardadas com bcrypt; rotas protegidas exigem JWT | PLANO §3 | Atende |
| RNF04 | Textos e documentação em português | CLAUDE.md | Sem auditoria completa |
| RNF05 | `docs/openapi.json` reflete as rotas reais | CONTRIBUTING | Atende: as 33 rotas coincidem com a aplicação |
| RNF06 | Testes offline verdes, e toda rota tem teste | CLAUDE.md | 61 testes offline e 13 de integração passam; sem teste: `GET /media/trending`, `GET /media/genres`, `GET /me/preferences` e `GET /health`. CI não consultado |
| RNF07 | Compatível com Python 3.11+ | README | Rodou em 3.13.5; o CI usa 3.12 |
| RNF08 | A interface exibe o crédito do TMDB | `docs/API.md` | Atende: o aviso e o logo estão na página Sobre, como o TMDB exige |
| RNF09 | O feed responde em até 1 s na máquina da demo | Aprovado em 06/11 | Atende: cerca de 115 ms com 3.966 títulos, no Docker |
| RNF10 | Coletar só nome, e-mail e histórico; na homologação, aceitar e-mail fictício e avisar que os dados ficam em um servidor externo | Aprovado em 06/11 | Aplicar no roteiro da homologação |

## Deploy

| ID | Requisito | Origem | Situação |
|---|---|---|---|
| RNF11 | API e interface publicadas em URL pública com HTTPS | Decisão de 05/11; [#21](https://github.com/joaolevi/cinematch/issues/21) | Não iniciado: o sistema já roda em Docker, e a publicação será no servidor do Vinicius |
| RNF12 | Em produção não há credencial publicada: segredo JWT próprio e senhas fora do repositório | Deploy | Atende: com `TASTORY_ENV=production`, a API e o seed recusam o segredo e as senhas públicas |
| RNF13 | Os dados sobrevivem a reinícios, com PostgreSQL | [#21](https://github.com/joaolevi/cinematch/issues/21) | Atende localmente: roda em PostgreSQL 16 no Docker, e os dados continuam depois de reiniciar |
| RNF14 | Em produção, o painel conta só interações reais | Deploy | **Não atende por padrão:** o auto-seed grava a simulação A/B. Ver o [guia de deploy](../DEPLOY.md) |
| RNF15 | O CORS libera apenas a origem do front publicado | Deploy | Configurável por `TASTORY_CORS_ORIGINS` |
| RNF16 | Entrada acima do limite devolve erro de validação (422), não erro 500 | Revisão de 06/11 | Atende: conferido no PostgreSQL |
| RNF17 | Diário e listas não fazem uma consulta ao banco por item | Revisão de 06/11 | Atende: o número de consultas não cresce com os itens |
| RNF19 | O sistema sobe em Docker com um comando, com API, interface e PostgreSQL | Decisão de 06/11 | Atende localmente: fluxo completo testado no navegador, e os dados continuam depois de reiniciar |
| RNF18 | Dependências com versões fixas | Revisão de 06/11 | **Não atende:** `requirements.txt` usa `>=`, e o bcrypt 5 foi instalado sem aviso, o que expôs a RN02 |

## Rastreabilidade

| ID | EAP | Como verificar |
|---|---|---|
| RNF01 | 4.3 | Rodar `./dev.sh` em um clone limpo, sem `.env`, e acessar `/health` |
| RNF02 | 4.3 | Confirmar que `git check-ignore .env` reconhece o arquivo |
| RNF03 | 3.2 | `test_auth.py` |
| RNF04 | 2.1 a 2.4, 4.3 | Revisar as telas e os documentos |
| RNF05 | 1.3 | Comparar as rotas da aplicação com `docs/openapi.json` |
| RNF06 | 4.1 | `pytest -m "not integration"` e CI |
| RNF07 | 4.1 | CI com Python 3.12 |
| RNF08 | 2.4 | Conferir o crédito na interface |
| RNF09 | 4.1 | Medir `GET /recommendations` na máquina da demo |
| RNF10 | 4.2 | Conferir o aviso no roteiro da homologação |
| RNF11 | 4.3 | Abrir a API e a interface pela URL pública, com HTTPS |
| RNF12 | 4.3 | Confirmar que o login com as senhas do repositório falha em produção |
| RNF13 | 3.1, 4.3 | Reiniciar o serviço e confirmar que os dados continuam lá |
| RNF14 | 4.2, 4.3 | Confirmar que o painel começa sem interações antes da homologação |
| RNF15 | 4.3 | Confirmar que o navegador bloqueia chamadas de outra origem |
| RNF16 | 3.2 | Enviar campos acima do limite no PostgreSQL e confirmar o erro 422 |
| RNF17 | 3.2 | Contar as consultas de `GET /diary` e `GET /lists` |
| RNF18 | 4.3 | Instalar em ambiente limpo e conferir as versões |
| RNF19 | 4.3 | Rodar `docker compose up --build` e testar o fluxo completo |
