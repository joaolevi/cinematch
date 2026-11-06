# Requisitos não funcionais

> [Voltar ao índice](README.md) · A forma de verificar cada requisito está no fim deste arquivo.

A coluna Situação mostra o que foi verificado em 05/11/2026. **Proposto** indica um requisito que ainda
precisa da confirmação da equipe.

## Gerais

| ID | Requisito | Origem | Situação |
|---|---|---|---|
| RNF01 | Depois de clonar, subir a API com um único comando (`./dev.sh`), sem chave de API; depois da primeira instalação, funcionar sem internet | PLANO §11 | API sobe e responde em `/health`; seed completo em 5,7 s. `dev.sh` e `demo.sh` ainda não testados. É o plano B do deploy |
| RNF02 | A chave do TMDB fica só no `.env`, fora do git | CLAUDE.md | Atende: `.env` está no `.gitignore` |
| RNF03 | Senhas guardadas com bcrypt; rotas protegidas exigem JWT | PLANO §3 | Atende |
| RNF04 | Textos e documentação em português | CLAUDE.md | Sem auditoria completa |
| RNF05 | `docs/openapi.json` reflete as rotas reais | CONTRIBUTING | Atende: as 33 rotas coincidem com a aplicação |
| RNF06 | Testes offline verdes, e toda rota tem teste | CLAUDE.md | 39 testes passam; sem teste: `GET /media/trending`, `GET /media/genres`, `GET /me/preferences` e `GET /health`. CI não consultado |
| RNF07 | Compatível com Python 3.11+ | README | Rodou em 3.13.5; o CI usa 3.12 |
| RNF08 | A interface exibe o crédito do TMDB | `docs/API.md` | Atende no `demo-front`; confirmar no front oficial |
| RNF09 | O feed responde em até 1 s na máquina da demo | **Proposto** | Medido localmente: até 67 ms com 153 títulos |
| RNF10 | Coletar só nome, e-mail e histórico; na homologação, aceitar e-mail fictício e avisar que os dados ficam em um servidor externo | **Proposto** | A confirmar pela equipe |

## Deploy

| ID | Requisito | Origem | Situação |
|---|---|---|---|
| RNF11 | API e interface publicadas em URL pública com HTTPS | Decisão de 05/11; [#21](https://github.com/joaolevi/cinematch/issues/21) | Não iniciado: o repositório não tem arquivo de deploy |
| RNF12 | Em produção não há credencial publicada: segredo JWT próprio e senhas fora do repositório | Deploy | **Não atende:** as senhas de admin, demo e usuários sintéticos estão fixas em `seed.py`, e o segredo JWT padrão é público |
| RNF13 | Os dados sobrevivem a reinícios, com PostgreSQL | [#21](https://github.com/joaolevi/cinematch/issues/21) | Parcial: testes offline, seed e feed passaram em PostgreSQL 14 numa cópia local; falta incluir o driver nas dependências |
| RNF14 | Em produção, o painel conta só interações reais | Deploy | **Não atende por padrão:** o auto-seed grava a simulação A/B. Ver o [guia de deploy](../DEPLOY.md) |
| RNF15 | O CORS libera apenas a origem do front publicado | Deploy | Configurável por `TASTORY_CORS_ORIGINS` |
| RNF16 | Entrada acima do limite devolve erro de validação (422), não erro 500 | Revisão de 06/11 | **Não atende:** no PostgreSQL, gênero com 70 caracteres e pôster com 600 geram erro 500; no SQLite dos testes, o erro não aparece |
| RNF17 | Diário e listas não fazem uma consulta ao banco por item | Revisão de 06/11 | **Não atende:** cerca de 100 consultas para 100 itens |
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
