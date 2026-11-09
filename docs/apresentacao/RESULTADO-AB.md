# Resultado do teste A/B

> Parte da [apresentação](README.md), slide 8. Responsável: Bárbara. Preencha os campos `[__]` com a
> [análise do teste interno](../HOMOLOGACAO.md#análise-bárbara), depois das 12h de 09/11.

## O texto do slide (1 minuto)

**A pergunta:** das sugestões que a pessoa viu, quantas ela aceitou?

**A conta:** sugestões aceitas ÷ sugestões exibidas.

- **Aceita:** a pessoa marcou "Quero ver" ou "Já vi" numa sugestão.
- **Exibida:** pelo menos metade do card ficou 1 segundo na tela.
- Cada par (pessoa, título) conta uma vez, mesmo que apareça de novo.

**Exemplo para falar:** 20 sugestões aparecem; a pessoa marca "Quero ver" em 3 e "Já vi" em 2. São 5 de 20: 25%.

**O teste A/B:** quem se cadastra entra alternadamente no grupo A (recomendador híbrido) ou no B (só o conteúdo dos títulos).
Os grupos são comparados só pelas sugestões personalizadas, porque as "Em alta" são iguais nos dois e apagariam a diferença.

## Os números do teste interno

| Grupo | Pessoas | Exibidas | Aceitas | Aceitação | Aceitas com nota | Satisfação |
|---|---|---|---|---|---|---|
| A · híbrido | [__] | [__] | [__] | [__]% | [__] | [__]% |
| B · só conteúdo | [__] | [__] | [__] | [__]% | [__] | [__]% |
| Todo mundo | [__] | [__] | [__] | [__]% | | |

**Satisfação:** das sugestões aceitas que depois ganharam nota, quantas ficaram com 3,5 ou mais. A aceitação mede interesse;
a satisfação, se a pessoa gostou do que aceitou.

## Como interpretar (fale isto, qualquer que seja o resultado)

- Com 6 pessoas, 3 por grupo, o resultado é **ilustrativo** (D15). Ele mostra que a medição funciona, não qual grupo é melhor.
- Se A ganhou de B: "vai na mesma direção do teste com o MovieLens, mas com 6 pessoas não dá para concluir".
- Se B ganhou de A ou empatou: "com tão pouca gente, a diferença é do acaso; a evidência de qualidade é o teste com o MovieLens,
  em que o híbrido ganhou com folga".
- A evidência de qualidade é o teste com o MovieLens (slide 7). A comparação com usuários reais, e uma meta para a taxa (D1),
  ficam para depois da entrega.
