# Avaliação do recomendador e das fontes

> **Versão 1, 10/11/2026.** Reúne as evidências, as fontes avaliadas e os experimentos que saíram de
> [ARQUITETURA.md](ARQUITETURA.md). Lá ficam as decisões; aqui, os números e como repetir cada teste.

## Experimentos

Avaliações planejadas, na ordem de implementação. O lugar de cada uma no plano está em
[incrementos.md](../requisitos/incrementos.md).

| ID | Requisito | Situação | Depende de | Esforço | Incremento | Antes |
|---|---|---|---|---|---|---|
| <a id="exp01"></a>EXP01 | Comparar offline, nos filmes do MovieLens, o modelo atual, o mesmo com *embeddings* e o grafo de gosto; fica o que ganhar (ver [O modelo depois do MVP](ARQUITETURA.md#o-modelo-depois-do-mvp)) | **Feito em 10/11:** empate com dados colaborativos; só com conteúdo, o grafo vence. Scripts `compare_models.py` e `check_popularity.py` | — | M | 2a | novo |
| <a id="exp04"></a>EXP04 | Confirmar no MovieLens 32M o resultado do EXP01, antes de construir o grafo de conteúdo (RNFF12) | Não feito. A base grande exige guardar só os vizinhos mais próximos de cada título, em vez da matriz inteira | EXP01 | P a M | 2a | novo |
| <a id="exp02"></a>EXP02 | Comparar, num teste A/B, o motivo escrito por modelo fixo com o mesmo motivo reescrito por IA | Não feito. Depende de guardar o motivo de forma estruturada e de orçamento | RNFF02 | P a M | 3 | RFF33 |
| <a id="exp03"></a>EXP03 | Medir, no teste A/B, a aceitação das sugestões cruzadas por tipo de ponte | Não feito | RFF27 | P | 5 | novo |

### Resultado do EXP01

Feito em 10/11/2026. MovieLens pequeno (100.836 notas, 610 pessoas, 3.650 filmes), sem nenhum dado do
TMDB. Os parâmetros de cada forma foram escolhidos no corte temporal, e o resultado foi medido nos últimos 20% de cada
pessoa (589 pessoas), com intervalo de confiança de 95% por bootstrap. Para repetir:
`backend/scripts/compare_models.py` e `backend/scripts/check_popularity.py`.

| Variante | NDCG@20 |
|---|---|
| Só conteúdo, TF-IDF (como o grupo B) | 0,022 |
| Só conteúdo, *embeddings* | 0,024 |
| Grafo só com conteúdo | 0,058 |
| Híbrido com peso 0,5 no conteúdo | 0,070 |
| Só os mais populares | 0,083 |
| Grafo completo | 0,122 |
| Híbrido TF-IDF com peso 0,2 no conteúdo | 0,124 |
| Híbrido com *embeddings* e peso 0,2 | 0,127 |

- **Com dados colaborativos, as três formas empatam:** as diferenças ficam abaixo de 0,006, dentro da margem de erro.
  O que muda é o peso: 0,2 no conteúdo quase dobra a qualidade em relação a 0,5. O recomendador já usa 0,2 quando o
  MovieLens está ligado; sem ele, o grupo A usa 0,5 e fica abaixo de "só os mais populares".
- **Só com conteúdo, o grafo fica bem à frente:** +0,037 sobre o TF-IDF (IC +0,028 a +0,046). Com o mesmo bônus de
  popularidade nos dois, a vantagem se mantém (+0,040; IC +0,030 a +0,051). Na cauda longa, sem os 10% de filmes mais
  avaliados, ela cai para cerca de +0,01, e o grafo acerta o mesmo sugerindo títulos menos famosos.
- **Os *embeddings*,** com só título, gênero e tags como texto, empatam com o TF-IDF.

A decisão tomada a partir deste resultado está em [O modelo depois do MVP](ARQUITETURA.md#o-modelo-depois-do-mvp) (D22).

## Evidências

Testes feitos em 05 e 06/11/2026. Para repetir o teste de qualidade, baixe o
[MovieLens](https://grouplens.org/datasets/movielens/latest/) e rode
`python -m scripts.evaluate_recommender <pasta-do-ml-latest-small>` a partir de `backend/`.

### Carga do recomendador atual

Código real, um feed por vez, catálogo sintético e 100 usuários com 30 registros cada.

| Títulos | Tempo por feed | Pico de memória |
|---|---|---|
| 153 | 15 ms | 146 MB |
| 5.000 | 118 ms | 362 MB |
| 10.000 | 216 ms | 988 MB |
| 20.000 | 676 ms | 3,3 GB |

### Qualidade com dados reais

MovieLens, 589 pessoas, escondendo os últimos 20% das avaliações de cada uma. A fórmula do recomendador foi
reproduzida, sem a etapa de diversidade. Quanto maior o NDCG@20, melhor a lista.

| Abordagem | NDCG@20 | Acertou ao menos 1 em 20 |
|---|---|---|
| Só conteúdo (grupo B) | 0,022 | 18% |
| Híbrido atual (grupo A) | 0,070 | 46% |
| Só popularidade | 0,083 | 43% |
| Híbrido com peso 0,2 no conteúdo | 0,122 | 60% |
| Colaborativo puro | 0,129 | 60% |
| Biblioteca pronta (ALS, `implicit`) | 0,132 | 62% |

A vantagem do grupo A sobre o B em NDCG@20 foi de +0,048 (IC 95%: +0,041 a +0,056), e cresceu com o número de
usuários: +0,016 com 30 e +0,048 com 610.

**Conclusões:** o híbrido supera o conteúdo com dados reais, ao contrário da simulação; o peso atual é ruim; e o
algoritmo não é o gargalo, porque a biblioteca pronta ficou quase igual ao nosso colaborativo puro. O que mais
falta são dados reais.

**Limites:** o teste não usa nosso catálogo, e esse corte favorece o resultado. No corte por data, mais rigoroso, o
híbrido também ganhou do conteúdo, mas com só 27 pessoas. A GroupLens informa que essa versão da base não serve
para publicar resultados de pesquisa, então trate o teste como exploratório.

### Dados reais, dados inventados e modelos prontos

Mesmo teste, agora com as características reais do TMDB (3.636 filmes). Peso ajustado é 0,2 no conteúdo. Para comparar,
a popularidade sozinha dá 0,083.

| Origem do colaborativo | NDCG@20, peso atual | NDCG@20, peso ajustado |
|---|---|---|
| Nenhuma (grupo B) | 0,020 | — |
| 30 usuários inventados, como hoje | 0,019 | 0,013 |
| 3.000 usuários inventados | 0,020 | 0,012 |
| 30 usuários reais | 0,078 | 0,087 |
| 610 usuários reais | 0,106 | 0,136 |
| **MovieLens 32M, 50 vizinhos por título** | **0,146** | **0,149** |
| MovieLens 32M, matriz completa | 0,125 | 0,154 |
| ALS pronto do Hugging Face, usado como similaridade entre filmes | 0,067 | 0,078 |

**Conclusões:** usuários inventados não ajudam, porque só repetem regras que nós mesmos escrevemos. Dados reais multiplicam
a qualidade, e guardar só 50 vizinhos por título quase não custa nada. O ALS pronto foi avaliado sem os fatores de usuário,
que não existem para os nossos usuários, então o teste mede só esse uso.

Modelo de texto pronto (`paraphrase-multilingual-MiniLM-L12-v2`, com as sinopses em português):

| Conteúdo | Sem colaborativo | Com o MovieLens 32M |
|---|---|---|
| TF-IDF, como hoje | 0,020 | 0,149 |
| Modelo de texto | 0,012 | 0,146 |
| Os dois juntos | 0,024 | 0,149 |

O modelo de texto não melhora o resultado e exige bibliotecas pesadas, então fica de fora por enquanto.

**Limites:** os testes usam pessoas e filmes do MovieLens, e o usuário do teste pode aparecer na base 32M. Nada disso mede
séries. No sistema real, 1.438 dos 1.985 filmes do catálogo têm vizinhos: os demais são recentes ou não estão na base.

O `backend/scripts/evaluate_recommender.py` reproduz só a comparação principal. As variações com ALS, modelo de texto e
usuários inventados foram testes pontuais e não estão no repositório.

### Séries sem dados reais

O MovieLens não tem séries, então testamos alternativas para elas. Como também não há avaliações públicas de séries, o teste
usa filmes como indicador, sem a parte colaborativa do MovieLens. A popularidade do teste vem das avaliações do próprio
MovieLens, e não do TMDB, o que favorece esse fator. Mesmas 589 pessoas, em NDCG@20:

| Peso da popularidade | Só conteúdo | Rota do TMDB | Conteúdo + rota do TMDB |
|---|---|---|---|
| 0,1, como hoje | 0,020 | 0,037 | 0,040 |
| 0,5 | 0,048 | 0,051 | 0,065 |
| 1 | 0,073 | 0,067 | 0,085 |
| 2 | 0,090 | 0,084 | 0,095 |
| 4 | 0,091 | 0,088 | 0,092 |

A rota é a `/recommendations` do TMDB, que cobriu 3.561 dos 3.636 filmes. A `/similar` ficou um pouco abaixo (0,034 sozinha,
0,038 com o conteúdo), e as duas ficam em 29% a 32% de acerto. A popularidade sozinha dá 0,083.

**Conclusões:** o que mais pesa é a popularidade, e aumentar o peso resolve boa parte do problema sem dado novo. A rota do
TMDB soma pouco quando a popularidade já pesa bastante, mas devolve listas coerentes: Breaking Bad traz Better Call Saul,
Narcos e Snowfall.

O número não conta tudo, porque essa métrica favorece títulos populares. No catálogo real, com perfis de drama, comédia e
animação:

- **Peso 0,1:** títulos obscuros, como *SOKO Köln* e *Arli$$*.
- **Peso 1:** títulos conhecidos e ainda parecidos com o perfil, como *Better Call Saul* e *Como Eu Conheci Sua Mãe*.
- **Peso 2:** a lista perde a relação com o perfil: quem gosta de comédia recebe *Sherlock* e *Os 100*.

**Decisão (D16):** usar peso 1 só para escolher quais séries ocupam os lugares delas no feed. Aplicar o peso direto na nota
aumentava a parte de séries: quem só gostava de filmes passava de 7 para 17 séries em 36 sugestões. Assim, os filmes e os lugares
das séries continuam iguais. A rota do TMDB fica como próximo passo, porque precisa de uma carga nova na tabela de vizinhos.

O catálogo também tem 849 títulos sem sinopse em português e 153 com o nome em outro alfabeto, como 논스톱. Eles vêm assim do TMDB
e pioravam a impressão do feed, então o feed só sugere títulos com sinopse, pôster e nome legível (RN20). Isso mantém 3.102 dos
3.957 títulos, e a busca continua mostrando todos. Cortar por popularidade não serve, porque tiraria lançamentos com poucos votos,
e filtrar por palavra-chave também não, porque "adult" aparece em títulos como *Os Simpsons*.

### Fontes avaliadas

| Fonte | O que oferece | Decisão |
|---|---|---|
| TMDB | Catálogo de filmes e séries e rotas de títulos relacionados | Continua como catálogo |
| MovieLens 32M | 32 milhões de avaliações, com ID do TMDB, só filmes | Usado nos filmes |
| IMDb | Filmes, séries, episódios e elenco; só médias, sem avaliações por pessoa | Opção para elenco, com uso não comercial |
| ListenBrainz | Dados abertos de música | Candidato para música |
| Last.fm | Tags de álbuns e artistas, artistas e faixas parecidos, histórico público de quem usa | Candidato para as tags de clima e os artistas parecidos; só uso não comercial, com atribuição, teto de 100 MB guardados e contato prévio exigido até para uso acadêmico |
| MusicBrainz e Cover Art Archive | Catálogo de música e capas; dados centrais CC0, tags CC BY-NC-SA; 1 requisição por segundo | Catálogo de música (RFF01), carregado por dumps ou em segundo plano |
| Wikidata | Ligações entre filmes, séries, pessoas e músicas (compositor, trilha, assunto, tema); CC0 | Fonte das pontes entre mídias, consultada offline pelo QLever ou por dumps |
| Spotify Web API | Busca e links; desde 2024, sem Recommendations e Audio Features para apps novos | Fora: em 2026, o modo de desenvolvimento aceita 5 pessoas e exige Premium, e os termos proíbem treinar modelos com os dados |
| Deezer API | Busca pública de álbuns, sem login | Só para links "onde ouvir": o cadastro de apps novos está bloqueado |
| Yambda | 4,79 bilhões de interações de música, com IDs anônimos | Não liga com o catálogo |
| Douban e Amazon Reviews | Mesmas pessoas em filmes e música, mas difíceis de ligar ao catálogo | Só para estudo |

### Arquitetura proposta

| | Hoje | Vizinhos guardados (50 por título) |
|---|---|---|
| Qualidade (NDCG@20, mesmos pesos) | 0,122 | 0,123 |
| Tempo com 20 mil títulos | 676 ms (feed completo) | 1,6 ms (só a consulta) |
| Memória com 20 mil títulos | 3,3 GB na API | 68 MB no banco, em disco |

Os tempos não são diretamente comparáveis, porque o segundo não inclui filtros nem explicação.
