# Perguntas prováveis da banca

> Parte da [apresentação](README.md). Respostas curtas para falar em 30 segundos; o detalhe está no link de cada uma.

## Gestão do projeto

**Como vocês controlaram o escopo?**
Sophia. Tudo que entrava ou saía do MVP passava pelo controle de mudanças, com o motivo e quem aprovou: são 33 mudanças
e 21 decisões registradas, a maioria aprovada pela gerência. Detalhe em [MVP](../MVP.md#controle-de-mudanças).

**Como dividiram o trabalho?**
Sophia. Por cargos (GP e backend, tech lead e requisitos, QA, DevOps, IA, front e design) e por uma matriz RACI por
pacote da EAP, com um único responsável final por pacote. Detalhe em [ENTREGAS](../ENTREGAS.md).

**O cronograma foi cumprido?**
Sophia. O MVP ficou pronto para a entrega no prazo, com dois ajustes registrados: o congelamento do front passou de domingo à noite para
segunda de manhã, e a decisão do deploy, de domingo para segunda, com o Vinicius (D17).

**Qual foi o maior risco e como trataram?**
Sophia ou Vinicius. O deploy no prazo. A resposta foi ter, desde o começo, um plano B testado: o sistema roda no notebook,
inclusive sem internet. Os 13 riscos estão no [MVP](../MVP.md#riscos), cada um com resposta e responsável.

**O que fariam diferente?**
Sophia. Decidir mais cedo onde fica cada parte do código (a interface saiu do repositório e voltou um dia depois) e definir
a métrica antes de construir o feed (a regra de "exibida" mudou três vezes).

## Produto e escopo

**Por que a música ficou de fora, se está no pitch?**
Levi. O pitch já previa a música para o segundo incremento. Ela exige uma fonte de dados nova (MusicBrainz), um tipo novo
de mídia e um recomendador separado (D7). A interface já está pronta para ela.

**Por que filmes e séries juntos, e música separada?**
Bárbara. O gosto por filmes e por séries se parece e usa os mesmos atributos (gênero, diretor, década). Música tem outros
sinais, então é recomendada à parte (D7).

**Quanto custou?**
Vinicius. Nada. O servidor é de um integrante, a API do TMDB é gratuita para uso não comercial, e todo o software é aberto.

## Recomendador e métrica

**Como vocês sabem que o recomendador é bom?**
Bárbara. Pelo teste com o MovieLens: escondemos os últimos filmes de cada pessoa e vemos se o recomendador os encontra. A
qualidade subiu de 0,019 para 0,149, quase o dobro de recomendar só os populares e no nível de uma biblioteca pronta de
mercado. Detalhe em [ARQUITETURA](../ARQUITETURA.md#evidências).

**0,149 não é pouco, numa escala até 1?**
Bárbara. O teste é difícil: a lista tem só 20 posições entre 3.636 filmes, e a pessoa poderia gostar de muitos que nunca viu.
Por isso o número se lê comparando com as alternativas no mesmo teste, e aí o resultado é bom.

**Por que precisaram do MovieLens?**
Bárbara. A parte "quem curtiu X curtiu Y" precisa do histórico de muita gente, e um sistema novo não tem. Com pessoas
inventadas, a qualidade quase não muda; com as 32 milhões de notas reais do MovieLens, ela multiplica. A licença só permite
uso não comercial.

**Seis pessoas no teste A/B provam alguma coisa?**
Bárbara. Não, e dizemos isso no slide: o teste interno mostra que a medição funciona (D15). A evidência de qualidade é o teste
com o MovieLens, e a comparação com usuários reais fica para depois da entrega.

**Por que a taxa de aceitação, e não a nota?**
Bárbara. A aceitação era a métrica do pitch e mede interesse: a pessoa quis ver ou já viu. A nota mostra se ela gostou, mas é
opcional. Por isso o próximo passo é a taxa de satisfação: das sugestões aceitas que ganharam nota, quantas foram bem avaliadas.

**Por que mudaram a regra de "sugestão exibida"?**
Bárbara. Com o feed infinito, quem rolava rápido "exibia" dezenas de cards sem olhar, e a taxa caía sem as sugestões serem
piores. Hoje conta só o que fica 1 segundo na tela, e a comparação entre os grupos usa só as sugestões personalizadas.

**Por que não usaram um modelo de IA pronto?**
Bárbara. Testamos: uma biblioteca de recomendação (ALS) e um modelo de texto para as sinopses. Nenhum melhorou o resultado o
suficiente para compensar o peso. O gargalo são os dados, não o algoritmo.

## Técnica e qualidade

**Como garantem a qualidade?**
Antonio. Quatro camadas: 128 testes automatizados, CI que roda testes e builds em todo PR, revisão de código e os roteiros do QA
na branch `homol`, antes da `main`.

**E a privacidade dos dados?**
Sophia. O sistema guarda só nome, e-mail e histórico. As senhas são guardadas com bcrypt, e o cadastro avisa que o que a pessoa
marca como Já vi aparece na Comunidade. Escolher quem vê os registros fica para depois (RFF11).

**O sistema aguenta muitos usuários?**
Sophia. Para o MVP, sim: o feed responde em cerca de 115 ms com quase 4 mil títulos. Para crescer, o plano é calcular as
recomendações antes e guardar no banco, porque hoje a memória cresce com o catálogo (RNFF02).

**Por que o projeto não tem migrações de banco?**
Sophia. Para o prazo do MVP, recriar o banco era suficiente e mais simples. Com usuários reais isso não serve, então as
migrações são o primeiro item técnico do pós-MVP (RNFF01).
