# Teste interno do MVP

> Responsável: Antonio. Parte do [MVP](MVP.md). Issue: [#14](https://github.com/joaolevi/cinematch/issues/14).

Em 09/11, até 12h, cada uma das 6 pessoas da equipe usa o sistema publicado por conta própria, com uma conta nova, para gerar
dados reais e achar problemas antes da apresentação. Leva cerca de 10 minutos.

Esta é a homologação do MVP (decisão D4). A homologação com pessoas de fora da equipe ficou para depois da entrega, por causa do
prazo. Como a equipe conhece o sistema, o resultado é ilustrativo (decisão D15). Na apresentação, chame de teste interno.

## Antes do teste

- [ ] Concluir o cartão "[QA] Testar a homol em 5 roteiros".
- [ ] Confirmar na URL pública que o sistema abre e que o Painel está zerado.
- [ ] Pedir ao Vinicius para [apagar as contas de teste](DEPLOY.md#apagar-uma-conta), para elas não entrarem na medição.
- [ ] Fazer o [backup](DEPLOY.md#5-fazer-backup) e criar a tag `homologacao-09-11`, como no [CONTRIBUTING](../CONTRIBUTING.md#branches-e-versões).

Se o sistema não estiver publicado, faça o teste em uma só máquina, com o [plano B](DEPLOY.md#plano-b), porque as métricas ficam
em um único banco.

## O que cada pessoa faz

Use uma conta nova e comum. As contas de admin não entram na medição.

Os dados ficam no servidor do Vinicius (RNF10), então você pode usar um e-mail fictício. Use uma senha que você não usa em
nenhum outro lugar. O que você marcar como Já vi fica visível para quem tem conta, na página Comunidade.

1. Crie a conta e responda às perguntas iniciais.
2. Reaja a pelo menos 10 sugestões do feed, do jeito que faria de verdade: **Quero ver**, **Já vi** ou **Não me interesso**.
3. Em um título que você já viu, dê uma nota e escreva uma resenha curta.
4. Busque um filme ou uma série de que você gosta e abra os detalhes.
5. Volte ao feed e veja se as sugestões mudaram.
6. Abra a Comunidade e veja os registros da equipe.
7. Responda às perguntas abaixo, no grupo ou em um comentário na issue #14.

## Perguntas

1. As sugestões combinaram com o seu gosto? (1 a 5)
2. Algo deu erro ou confundiu você? O quê?
3. O que você mudaria antes da apresentação?

## Depois do teste

Registre na [issue #14](https://github.com/joaolevi/cinematch/issues/14):

- data, número de participantes e forma do teste (URL pública ou uma máquina);
- print do Painel, com a taxa total e por grupo;
- resumo das respostas e os problemas encontrados, com o link do cartão de cada um.

A Bárbara usa esses dados na análise da taxa de aceitação. Um título só conta como exibido quando pelo menos metade do card
aparece na tela, mesmo que a pessoa não pare para olhar. A evidência de qualidade do recomendador continua sendo o teste com
o MovieLens ([arquitetura](ARQUITETURA.md#evidências)).

Para um erro que atrapalha a demonstração, crie um cartão com a etiqueta `Bug` no Trello e avise a equipe no mesmo dia.
