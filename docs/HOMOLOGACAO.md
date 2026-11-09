# Teste interno do MVP

> Responsável: Antonio. Parte do [MVP](MVP.md). Issue: [#14](https://github.com/joaolevi/cinematch/issues/14).

Em 09/11, até 12h, cada uma das 6 pessoas da equipe usa o sistema publicado por conta própria, com uma conta nova, para gerar
dados reais e achar problemas antes da apresentação. Leva cerca de 10 minutos.

Esta é a homologação do MVP (decisão D4). A homologação com pessoas de fora da equipe ficou para depois da entrega, por causa do
prazo. Como a equipe conhece o sistema, o resultado é ilustrativo (decisão D15). Na apresentação, chame de teste interno.

## Antes do teste

- [x] Concluir o cartão "[QA] Testar a homol em 5 roteiros".
- [ ] Confirmar na URL pública que o sistema abre e que o Painel está zerado.
- [ ] Apagar as contas de teste em **Administração → Usuários → Apagar conta** (ou como no [DEPLOY](DEPLOY.md#apagar-uma-conta)), para elas não entrarem na medição.
- [ ] Fazer o [backup](DEPLOY.md#5-fazer-backup) e criar a tag `homologacao-09-11`, como no [CONTRIBUTING](../CONTRIBUTING.md#branches-e-versões).

Se o sistema não estiver publicado, faça o teste em uma só máquina, com o [plano B](DEPLOY.md#plano-b), porque as métricas ficam
em um único banco.

## O que cada pessoa faz

Use uma conta nova e comum. As contas de admin não entram na medição.

Os dados ficam no servidor do Vinicius (RNF10), então você pode usar um e-mail fictício. Use uma senha que você não usa em
nenhum outro lugar. O que você marcar como Já vi fica visível para quem tem conta, na página Comunidade.

1. Abra o endereço, leia a apresentação, clique em **Começar o meu diário**, crie a conta e responda às perguntas iniciais.
2. Em **Para você**, reaja a pelo menos 10 sugestões, do jeito que faria de verdade: **Quero ver**, **Já vi** ou o **✕** no canto
   do pôster, que é o **Não me interesso**.
3. Pelo botão **+ Registrar**, no topo, registre um título que você viu recentemente, com nota e uma resenha curta.
4. Busque um filme ou uma série de que você gosta e abra os detalhes.
5. Volte ao **Para você** e veja se as sugestões mudaram. Depois, abra o **Diário** e a aba **Meu gosto**.
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
fica 1 segundo na tela, e o feed só traz mais sugestões quando a pessoa clica em **Ver mais sugestões**. A comparação
entre os grupos usa só as sugestões personalizadas, sem as "Em alta". A evidência de qualidade do recomendador continua sendo o teste com
o MovieLens ([arquitetura](ARQUITETURA.md#evidências)).

## Análise (Bárbara)

O painel da administração já mostra a taxa de todo mundo e a comparação entre os grupos, só com as sugestões
personalizadas. A consulta abaixo traz os mesmos números e mais uma medida, a **satisfação**: das sugestões aceitas
que depois ganharam nota, quantas ficaram com 3,5 ou mais. A aceitação mede interesse; a satisfação, se a pessoa gostou.

```sql
-- Aceitação e satisfação por grupo, só com sugestões personalizadas e pessoas reais
with pessoas as (
  select id, ab_group from users
  where role = 'user' and not is_synthetic and email <> 'demo@tastory.dev'
),
exibidas as (
  select distinct e.user_id, e.media_id, p.ab_group
  from rec_events e join pessoas p on p.id = e.user_id
  where e.action = 'shown' and e.strategy <> 'trending'
),
aceitas as (
  select distinct user_id, media_id from rec_events where action in ('want', 'seen')
)
select
  x.ab_group as grupo,
  count(distinct x.user_id) as pessoas,
  count(*) as exibidas,
  count(a.user_id) as aceitas,
  round(100.0 * count(a.user_id) / nullif(count(*), 0), 1) as aceitacao_pct,
  count(d.rating) as aceitas_com_nota,
  round(avg(d.rating)::numeric, 2) as nota_media,
  round(100.0 * count(*) filter (where d.rating >= 3.5) / nullif(count(d.rating), 0), 1) as satisfacao_pct
from exibidas x
left join aceitas a on a.user_id = x.user_id and a.media_id = x.media_id
left join diary_entries d on d.user_id = x.user_id and d.media_id = x.media_id and a.user_id is not null
group by x.ab_group
order by x.ab_group;
```

No servidor:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db psql -U tastory tastory < analise.sql
```

| Grupo | Pessoas | Exibidas | Aceitas | Aceitação | Aceitas com nota | Nota média | Satisfação |
|---|---|---|---|---|---|---|---|
| A (híbrido) | | | | | | | |
| B (só conteúdo) | | | | | | | |

Com 6 pessoas, os números são ilustrativos (D15): apresente-os como prova de que a medição funciona, ao lado do teste com o
MovieLens. A satisfação terá poucos casos, porque a nota é opcional; ela entra como próximo passo (RFF15).

Para um erro que atrapalha a demonstração, crie um cartão com a etiqueta `Bug` no Trello e avise a equipe no mesmo dia.
