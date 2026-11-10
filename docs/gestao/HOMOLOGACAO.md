# Teste com pessoas (homologação)

> **Versão 2, 10/11/2026.** Responsável: Antonio (QA). Roteiro para a beta do incremento 3 ([plano](../requisitos/incrementos.md)).

O teste interno do MVP, previsto para 09/11 com as 6 pessoas da equipe (decisão D4), **não aconteceu**. A homologação
com pessoas passa para a beta do incremento 3, depois da LGPD (RNFF08) e da página "Como recomendamos" (RFF17). Com
poucas pessoas, o resultado é ilustrativo (decisão D15); a evidência de qualidade do recomendador continua sendo o teste
com o MovieLens ([avaliação](../tecnico/AVALIACAO.md#evidências)).

## Antes do teste

- [ ] Concluir os roteiros do QA na versão que vai para o teste.
- [ ] Confirmar no endereço do teste que o sistema abre e que o Painel está zerado.
- [ ] Apagar as contas de teste em **Administração → Usuários → Apagar conta** (ou como no [DEPLOY](../tecnico/DEPLOY.md#apagar-uma-conta)), para elas não entrarem na medição.
- [ ] Fazer o [backup](../tecnico/DEPLOY.md#5-fazer-backup) e criar a tag `homologacao-AAAA-MM-DD` na versão testada, como no [CONTRIBUTING](../../CONTRIBUTING.md#branches-e-versões).

Se o sistema não estiver publicado, faça o teste em uma só máquina, com o [plano B](../tecnico/DEPLOY.md#plano-b), porque as métricas ficam
em um único banco.

## O que cada pessoa faz

Use uma conta nova e comum. As contas de admin não entram na medição. Leva cerca de 10 minutos.

Os dados ficam no servidor do Vinicius (RNF10). Use uma senha que você não usa em nenhum outro lugar. O que você marcar
como Já vi fica visível para quem tem conta, na página Comunidade.

1. Abra o endereço, leia a apresentação, clique em **Começar o meu diário**, crie a conta e responda às perguntas iniciais.
2. Em **Para você**, reaja a pelo menos 10 sugestões, do jeito que faria de verdade: **Quero ver**, **Já vi** ou o **✕** no canto
   do pôster, que é o **Não me interesso**.
3. Pelo botão **+ Registrar**, no topo, registre um título que você viu recentemente, com nota e uma resenha curta.
4. Busque um filme ou uma série de que você gosta e abra os detalhes.
5. Volte ao **Para você** e veja se as sugestões mudaram. Depois, abra o **Diário** e a aba **Meu gosto**.
6. Abra a Comunidade e veja os registros das outras pessoas.
7. Responda às perguntas abaixo, no canal combinado para o teste.

## Perguntas

1. As sugestões combinaram com o seu gosto? (1 a 5)
2. Algo deu erro ou confundiu você? O quê?
3. O que você mudaria?

## Depois do teste

Registre numa issue do teste:

- data, número de participantes e forma do teste (endereço publicado ou uma máquina);
- print do Painel, com a taxa total e por grupo;
- resumo das respostas e os problemas encontrados, com o link do cartão de cada um.

Na análise da taxa de aceitação, um título só conta como exibido quando pelo menos metade do card fica 1 segundo na
tela, e o feed só traz mais sugestões quando a pessoa clica em **Ver mais sugestões**. A comparação entre os grupos usa
só as sugestões personalizadas, sem as "Em alta".

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
MovieLens. A satisfação terá poucos casos, porque a nota é opcional; ela entra como próximo passo (RFF04).

Para um erro que atrapalha a demonstração, crie um cartão com a etiqueta `Bug` no Trello e avise a equipe no mesmo dia.
