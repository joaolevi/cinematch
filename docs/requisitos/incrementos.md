# Plano de incrementos

> **Versão 1, 10/11/2026.** Visão geral dos requisitos do sistema final, na ordem de implementação. O detalhe de cada um
> está em [funcionais.md](funcionais.md#futuros), [nao-funcionais.md](nao-funcionais.md#futuros) e, para os experimentos,
> em [AVALIACAO.md](../tecnico/AVALIACAO.md#experimentos). O MVP, entregue em 10/11/2026, está em
> [MVP.md](../gestao/MVP.md).

Notas de 1 a 5: **Prio.** é a prioridade (quando fazer), **Nec.** a necessidade (quanto a promessa do pitch depende dele) e
**Inov.** a inovação (distância dos concorrentes pesquisados). Esforço: P até uma semana, M de 1 a 3 semanas, G várias
semanas. RFF são funcionais, RNFF não funcionais e EXP experimentos.

## Incremento 2a: base, medição e o grafo de conteúdo

Base técnica, a métrica corrigida e o grafo de conteúdo, que já melhora as séries e o grupo B antes da música. É a primeira metade do incremento 2 (D23).

| ID | Requisito | Tipo | Situação | Esforço | Prio. | Nec. | Inov. | Depende de |
|---|---|---|---|---|---|---|---|---|
| [RNFF01](nao-funcionais.md#rnff01) | Mudar o banco sem apagar dados, com migrações | Não funcional | Não iniciado | P | 5 | 5 | 1 | — |
| [RNFF02](nao-funcionais.md#rnff02) | Respeitar os termos e as licenças das fontes | Não funcional | Não iniciado | P | 5 | 4 | 1 | — |
| [RNFF04](nao-funcionais.md#rnff04) | Contar a aceitação só perto da exibição | Não funcional | Não iniciado | P | 5 | 4 | 1 | — |
| [RNFF05](nao-funcionais.md#rnff05) | Limitar tentativas de login | Não funcional | Não iniciado | P | 4 | 3 | 1 | — |
| [RFF03](funcionais.md#rff03) | Pedir a nota na hora certa | Funcional | Não iniciado | P | 5 | 4 | 2 | — |
| [RFF04](funcionais.md#rff04) | Taxa de satisfação no painel | Funcional | Não iniciado | P | 5 | 4 | 1 | — |
| [EXP01](../tecnico/AVALIACAO.md#exp01) | Comparar modelos de recomendação offline | Experimento | Feito | M | 4 | 3 | 3 | — |
| [EXP04](../tecnico/AVALIACAO.md#exp04) | Confirmar o EXP01 no MovieLens 32M | Experimento | Não iniciado | P a M | 3 | 2 | 2 | EXP01 |
| [RNFF12](nao-funcionais.md#rnff12) | Grafo de conteúdo para séries, música e grupo B | Não funcional | Não iniciado | M | 5 | 4 | 4 | EXP04 |

## Incremento 2b: a história do seu gosto em três mídias

A música como terceira mídia, já pelo grafo, e o Meu gosto nas três mídias. Cumpre a única promessa do pitch que falta.

| ID | Requisito | Tipo | Situação | Esforço | Prio. | Nec. | Inov. | Depende de |
|---|---|---|---|---|---|---|---|---|
| [RNFF03](nao-funcionais.md#rnff03) | Rotinas em segundo plano | Não funcional | Não iniciado | M | 4 | 4 | 1 | RNFF01 |
| [RNFF06](nao-funcionais.md#rnff06) | Dados reais na parte colaborativa | Não funcional | Parcial | M | 4 | 4 | 1 | RFF01; a parte de música |
| [RNFF07](nao-funcionais.md#rnff07) | Feed rápido com catálogo grande | Não funcional | Não iniciado | M | 4 | 3 | 1 | RNFF03 |
| [RFF01](funcionais.md#rff01) | Álbuns como terceira mídia | Funcional | Não iniciado | G | 5 | 5 | 4 | RNFF01, RNFF03 |
| [RFF02](funcionais.md#rff02) | Recomendar música | Funcional | Não iniciado | M | 5 | 5 | 3 | RFF01, RNFF12 |
| [RFF05](funcionais.md#rff05) | Retrospectiva do gosto | Funcional | Não iniciado | P a M | 4 | 3 | 3 | usa o Meu gosto (RF23) |
| [RFF06](funcionais.md#rff06) | Excluir e exportar os próprios dados | Funcional | Parcial | P | 4 | 3 | 2 | — |

## Incremento 3: beta aberta, social e controle

Preparar a abertura para pessoas de fora, o social mínimo e o controle sobre o próprio gosto.

| ID | Requisito | Tipo | Situação | Esforço | Prio. | Nec. | Inov. | Depende de |
|---|---|---|---|---|---|---|---|---|
| [RNFF08](nao-funcionais.md#rnff08) | Cumprir a LGPD | Não funcional | Não iniciado | P a M | 4 | 3 | 1 | — |
| [RFF07](funcionais.md#rff07) | Ver e corrigir o meu perfil de gosto | Funcional | Não iniciado | M | 4 | 2 | 5 | RNFF01 |
| [RFF08](funcionais.md#rff08) | Dar retorno sobre uma sugestão | Funcional | Não iniciado | M | 3 | 2 | 4 | RFF07; o "mais leve" depende do RNFF09 |
| [RFF09](funcionais.md#rff09) | Seguir pessoas | Funcional | Não iniciado | M | 3 | 2 | 1 | RNFF01 |
| [RFF10](funcionais.md#rff10) | Escolher quem vê meus registros | Funcional | Não iniciado | P a M | 3 | 3 | 1 | RFF09 |
| [RFF11](funcionais.md#rff11) | Perfil público com a história do gosto | Funcional | Parcial | M | 3 | 3 | 2 | RFF10 |
| [RFF12](funcionais.md#rff12) | Registrar o mesmo título mais de uma vez | Funcional | Não iniciado | M | 3 | 3 | 1 | RNFF01 |
| [RFF13](funcionais.md#rff13) | Adicionar qualquer título sem o admin | Funcional | Parcial | P | 3 | 3 | 1 | — |
| [RFF14](funcionais.md#rff14) | Recuperar a senha e verificar o e-mail | Funcional | Não iniciado | M | 3 | 3 | 1 | RNFF01 |
| [RFF15](funcionais.md#rff15) | Compatibilidade de gosto | Funcional | Não iniciado | P a M | 3 | 2 | 3 | RFF11 |
| [RFF16](funcionais.md#rff16) | Modo descoberta | Funcional | Não iniciado | P | 3 | 2 | 4 | — |
| [RFF17](funcionais.md#rff17) | Página "Como recomendamos" | Funcional | Não iniciado | P | 4 | 3 | 2 | RNFF08 |
| [RFF18](funcionais.md#rff18) | Importar o histórico de outros apps | Funcional | A definir | M | — | 2 | 2 | RFF12, RFF13, RFF01 |
| [EXP02](../tecnico/AVALIACAO.md#exp02) | Teste A/B do motivo reescrito por IA | Experimento | Não iniciado | P a M | 3 | 2 | 5 | RNFF02; e orçamento |

## Incremento 4: clima, momento e onde assistir

O vocabulário de clima e tudo que depende dele, mais os serviços de streaming.

| ID | Requisito | Tipo | Situação | Esforço | Prio. | Nec. | Inov. | Depende de |
|---|---|---|---|---|---|---|---|---|
| [RNFF09](nao-funcionais.md#rnff09) | Vocabulário de clima comum | Não funcional | Não iniciado | M a G | 2 | 2 | 4 | RNFF02 |
| [RFF19](funcionais.md#rff19) | Onde assistir ou ouvir | Funcional | Não iniciado | M a G | 2 | 2 | 3 | RNFF03; a música depende do RFF01 |
| [RFF20](funcionais.md#rff20) | Sugestões pelo momento | Funcional | Não iniciado | M | 2 | 2 | 4 | RNFF09; "Hoje à noite" com outra pessoa vem com o RFF28 |
| [RFF21](funcionais.md#rff21) | Meus serviços | Funcional | Não iniciado | P a M | 2 | 2 | 2 | RFF19 |
| [RFF22](funcionais.md#rff22) | Quero ver ordenado pelo que combina agora | Funcional | Não iniciado | P a M | 2 | 2 | 3 | RFF19, RFF20 |
| [RFF23](funcionais.md#rff23) | Buscar por clima | Funcional | Não iniciado | M | 2 | 1 | 4 | RNFF09, RFF01 |
| [RFF24](funcionais.md#rff24) | Séries por temporada | Funcional | Não iniciado | M | 2 | 2 | 2 | RFF12 |
| [RFF25](funcionais.md#rff25) | Pedido em português | Funcional | Não iniciado | M | 2 | 1 | 5 | RFF20, RNFF09; e orçamento |

## Incremento 5: pontes entre mídias e grupo

As sugestões que cruzam filmes, séries e música, e assistir ou ouvir junto.

| ID | Requisito | Tipo | Situação | Esforço | Prio. | Nec. | Inov. | Depende de |
|---|---|---|---|---|---|---|---|---|
| [RNFF10](nao-funcionais.md#rnff10) | Vizinhos sem domínio dos populares | Não funcional | Não iniciado | P a M | 2 | 2 | 1 | RNFF06 |
| [RFF26](funcionais.md#rff26) | Ligações entre mídias no detalhe | Funcional | Não iniciado | G | 2 | 1 | 5 | RFF01, RNFF03; começa por compositor e trilha (M) |
| [RFF27](funcionais.md#rff27) | Sugestões cruzadas no feed | Funcional | Não iniciado | G | 2 | 1 | 5 | RFF26, RNFF09 |
| [RFF28](funcionais.md#rff28) | Assistir ou ouvir junto | Funcional | Não iniciado | M | 2 | 1 | 3 | RFF15 |
| [EXP03](../tecnico/AVALIACAO.md#exp03) | Aceitação por tipo de ponte | Experimento | Não iniciado | P | 2 | 2 | 3 | RFF27 |

## Depois: com dados reais ou folga

O fim das cadeias de dependência e o que precisa de muitas aceitações reais.

| ID | Requisito | Tipo | Situação | Esforço | Prio. | Nec. | Inov. | Depende de |
|---|---|---|---|---|---|---|---|---|
| [RNFF11](nao-funcionais.md#rnff11) | Pesos aprendidos com as aceitações | Não funcional | Não iniciado | M | 1 | 2 | 3 | EXP03; e aceitações suficientes |
| [RFF29](funcionais.md#rff29) | Aviso do Quero ver | Funcional | Não iniciado | M | 1 | 1 | 2 | RFF21 |
| [RFF30](funcionais.md#rff30) | Curtir e comentar resenhas | Funcional | Não iniciado | M | 1 | 1 | 1 | RNFF01 |
| [RFF31](funcionais.md#rff31) | Histórico de atividades | Funcional | Não iniciado | M | 1 | 1 | 1 | RFF09, RFF30, RFF10 |
| [RFF32](funcionais.md#rff32) | Tema do mês | Funcional | Não iniciado | P a M | 1 | 1 | 3 | usa as listas que já existem |

## Numeração anterior

| Antes | Agora | O que aconteceu |
|---|---|---|
| RFF01 | RFF01 | Unificado em RFF01 |
| RFF02 | RFF02 | Mantido |
| RFF03 | RFF12 | Renumerado |
| RFF04 | RFF13 | Renumerado |
| RFF05 | RFF24 | Renumerado |
| RFF06 | RFF14 | Renumerado |
| RFF07 | RFF06 | Unificado em RFF06 |
| RFF08 | RFF11 | Renumerado |
| RFF09 | RFF27 | Unificado em RFF27 |
| RFF10 | RFF09 | Renumerado |
| RFF11 | RFF10 | Renumerado |
| RFF12 | RFF30 | Unificado em RFF30 |
| RFF13 | RFF30 | Unificado em RFF30 |
| RFF14 | RFF03 | Renumerado |
| RFF15 | RFF04 | Renumerado |
| RFF16 | RFF31 | Renumerado |
| RFF17 | RFF05 | Unificado em RFF05 |
| RFF18 | RFF07 | Parte foi para RFF07 |
| RFF18 | RFF08 | Parte foi para RFF08 |
| RFF19 | RFF19 | Mantido |
| RFF20 | RFF28 | Renumerado |
| RFF21 | RFF20 | Unificado em RFF20 |
| RFF22 | RFF26 | Unificado em RFF26 |
| RFF23 | RFF27 | Unificado em RFF27 |
| RFF24 | RFF26 | Unificado em RFF26 |
| RFF25 | RFF23 | Renumerado |
| RFF26 | RFF01 | Unificado em RFF01 |
| RFF27 | RFF21 | Renumerado |
| RFF28 | RFF29 | Renumerado |
| RFF29 | RFF20 | Unificado em RFF20 |
| RFF30 | RFF15 | Unificado em RFF15 |
| RFF31 | RFF22 | Renumerado |
| RFF32 | RFF07 | Unificado em RFF07 |
| RFF33 | EXP02 | Renumerado |
| RFF34 | RFF08 | Unificado em RFF08 |
| RFF35 | RFF25 | Renumerado |
| RFF36 | RFF16 | Renumerado |
| RFF37 | RFF05 | Unificado em RFF05 |
| RFF38 | RFF06 | Parte foi para RFF06 |
| RFF38 | RFF17 | Parte foi para RFF17 |
| RFF39 | RFF18 | Renumerado |
| RFF40 | RFF32 | Unificado em RFF32 |
| RFF41 | RFF15 | Unificado em RFF15 |
| RFF42 | RFF32 | Unificado em RFF32 |
| RNFF01 | RNFF01 | Mantido |
| RNFF02 | RNFF07 | Renumerado |
| RNFF03 | RNFF05 | Renumerado |
| RNFF04 | RNFF03 | Unificado em RNFF03 |
| RNFF05 | RNFF06 | Renumerado |
| RNFF06 | RNFF04 | Renumerado |
| RNFF07 | RNFF09 | Renumerado |
| RNFF08 | RNFF03 | Unificado em RNFF03 |
| RNFF09 | RNFF02 | Renumerado |
| RNFF10 | RNFF11 | Renumerado |
| RNFF11 | RNFF10 | Renumerado |
| — | EXP01 | Novo |
| — | EXP03 | Novo |
| — | EXP04 | Novo |
| — | RNFF12 | Novo |
| — | RNFF08 | Novo |
