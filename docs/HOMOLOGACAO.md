# Roteiro da homologação

> **Rascunho para o Antonio revisar.** Responsável: Antonio. Parte do [MVP](MVP.md). Issue: [#14](https://github.com/joaolevi/cinematch/issues/14).

A homologação é uma sessão com 5 a 10 colegas, em 09/11, para ver pessoas de fora usando o sistema. O resultado é ilustrativo
(decisão D15): com tão poucas pessoas, a taxa de aceitação mostra que a medição funciona, mas não prova qual grupo é melhor.

## Antes da sessão

- [ ] Fazer o fluxo completo na URL pública, com uma conta de teste.
- [ ] Confirmar no Painel que a taxa de aceitação está em 0 e que os títulos aparecem com pôster.
- [ ] Pedir ao Vinicius para [apagar a conta de teste](DEPLOY.md#apagar-uma-conta), para ela não entrar na medição.
- [ ] Criar o formulário a partir das perguntas abaixo.
- [ ] Combinar com os colegas o horário e o tempo: cerca de 10 minutos para cada pessoa.

Se o sistema não estiver publicado, faça a sessão em uma só máquina, com o [plano B](DEPLOY.md#plano-b), porque as métricas
ficam em um único banco.

## Aviso para os participantes

Envie este texto antes de passar o link (RNF10):

> Oi! Estamos testando o Tastory, um diário de filmes e séries que aprende com o seu gosto para sugerir o que ver. É um
> trabalho da disciplina de Gerência de Projeto da UFAL.
>
> Antes de começar:
>
> - O sistema guarda seu nome, seu e-mail e o que você registrar nele. Esses dados ficam em um servidor externo, na casa de
>   um integrante da equipe.
> - Você pode usar um e-mail fictício, como `seunome@teste.com`. Não precisa ser um e-mail real, e nenhuma mensagem será enviada.
> - Use uma senha que você não usa em nenhum outro lugar.
> - As resenhas podem ser vistas por outras pessoas no sistema.
> - Vamos usar os resultados de forma agrupada, sem citar nomes, na apresentação da disciplina.
> - Depois da entrega, se quiser, pedimos para apagar sua conta. É só avisar a equipe.

Se a sessão for em uma só máquina, troque "em um servidor externo, na casa de um integrante da equipe" por "no computador da equipe".

## Tarefas dos participantes

Sem explicar os botões antes: o objetivo é ver se a pessoa consegue sozinha.

1. Crie uma conta no link que enviamos.
2. Responda às perguntas iniciais sobre o que você gosta de assistir.
3. Olhe as sugestões do feed e leia o motivo de algumas delas.
4. Reaja a pelo menos 10 sugestões, do jeito que faria de verdade: **Quero ver**, **Já vi** ou **Não me interesso**.
5. Em um título que você já viu, dê uma nota e escreva uma resenha curta.
6. Busque um filme ou uma série de que você gosta e abra os detalhes.
7. Crie uma lista e coloque um título nela.
8. Volte ao feed e veja se as sugestões mudaram.
9. Responda ao formulário.

## Formulário

Sem perguntar nome nem e-mail.

1. Foi fácil criar a conta e começar? (1 a 5)
2. As sugestões combinaram com o seu gosto? (1 a 5)
3. Os motivos das sugestões fizeram sentido? (1 a 5)
4. O feed mudou depois que você reagiu às sugestões? (Sim, não ou não reparei)
5. Você encontrou os títulos que procurou? (Sim, alguns ou não). Quais ficaram de fora?
6. Algo deu erro ou confundiu você? O quê?
7. Você usaria o Tastory depois deste teste? (Sim, talvez ou não). Por quê?

## Durante a sessão

Anote, sem interromper a pessoa:

- onde ela travou ou pediu ajuda;
- qualquer erro na tela;
- títulos que ela procurou e não encontrou. Depois, importe esses títulos pelo admin, em **Catálogo → Buscar no TMDB**.

Para um erro que atrapalha a demonstração, crie um cartão com a etiqueta `bug` no Trello e avise a equipe no mesmo dia.

## Depois da sessão

Registre na [issue #14](https://github.com/joaolevi/cinematch/issues/14):

- data, número de participantes e forma da sessão (URL pública ou uma máquina);
- print do Painel, com a taxa total e por grupo, e o número de pessoas em cada grupo;
- médias das perguntas 1 a 3 e contagem das perguntas 4, 5 e 7;
- problemas encontrados, com o link do cartão de cada um.

A Bárbara usa esses dados na análise da taxa de aceitação. O feed carrega mais títulos ao rolar e ao trocar as sugestões, e todos contam como exibidos, então quem faz isso mais vezes tende a ter uma taxa menor. Na apresentação, trate o resultado como ilustrativo e use o
teste com o MovieLens como evidência de qualidade ([arquitetura](ARQUITETURA.md#evidências)).

Não apague os dados antes da apresentação. Quem pedir a exclusão da conta deve ser atendido depois da entrega, com o [comando do guia de deploy](DEPLOY.md#apagar-uma-conta).
