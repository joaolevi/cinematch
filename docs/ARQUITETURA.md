# Arquitetura e sistema final

> **Versão 3, 10/11/2026.** Requisitos do sistema final renumerados na ordem de implementação. Validação técnica: Bárbara (IA) e Levi (TL). Aprovação: Sophia (GP).
> Este documento trata do sistema final, com filmes, séries e música. O que será entregue em 10/11 está em [MVP.md](MVP.md).

## Decisões

| ID | Decisão | Motivo | Quem aprovou |
|---|---|---|---|
| D7 | Filmes e séries são recomendados juntos; música é recomendada separadamente | Filmes e séries já compartilham gêneros, diretores e dados. Cruzar com música exige pessoas que consomem as duas coisas, e ainda não temos esses dados | Sophia (GP), 06/11 |
| D8 | O MVP mantém o cálculo atual; a mudança de arquitetura fica para depois de 10/11. As exceções são a tabela de vizinhos do MovieLens (D14) e o ajuste nas séries (D16) | Com o catálogo atual, o feed responde em milissegundos, e trocar agora colocaria a entrega em risco | Sophia (GP), 06/11 |
| D14 | Os vizinhos do MovieLens 32M substituem os usuários inventados nos filmes, com a opção desligada por padrão | Foi a maior melhora medida, e a opção desligada protege a entrega | Sophia (GP), 06/11 |

A recomendação cruzada entre filmes e música fica como evolução: o diário unificado vai gerar esses dados com o tempo.

## O que mantemos

- API única em FastAPI, com PostgreSQL em produção.
- Recomendador dentro do backend, sem serviço separado.
- Abordagem híbrida, explicação de cada sugestão e teste A/B.
- Interface `CatalogProvider`, que permite incluir o MusicBrainz sem mudar o restante do sistema.

## O que muda depois do MVP

### Calcular antes, consultar depois

Hoje o recomendador refaz todos os cálculos a cada abertura do feed. No sistema final, um processo separado
calcula os títulos mais parecidos com cada título e guarda esses vizinhos em uma tabela. Ao abrir o feed, o
sistema só lê os vizinhos do histórico da pessoa, soma as pontuações, filtra e explica.

### Uma tabela, várias fontes

A mesma tabela recebe vizinhos de origens diferentes, o que permite tratar cada mídia com a fonte adequada:

| Mídia | Fonte de "quem curtiu X curtiu Y" | Observação |
|---|---|---|
| Filmes | MovieLens 32M | Já implementado, com a opção `TASTORY_USE_EXTERNAL_NEIGHBORS`. A licença proíbe uso comercial sem permissão |
| Séries | Rotas de recomendação do TMDB | Ainda não implementado. Não há base pública com avaliações de séries por pessoa e ID do TMDB |
| Música | ListenBrainz | Dados abertos (CC0), ligados ao MusicBrainz. Não há similaridade por álbum pronta: ela sai dos artistas e das gravações |
| Entre mídias | Interações da própria plataforma | Só funciona com usuários reais |

### Recomendação entre mídias

Quase não há base pública com as mesmas pessoas avaliando filmes e música (por isso a D7). A saída é ligar as
mídias por pontes de metadados, calculadas antes e guardadas na tabela de vizinhos, cada uma com um peso.
Cobertura medida no Wikidata em 10/11/2026, por contagem direta (subestima um pouco):

| Ponte | Liga | Fonte | Peso | Exemplo de motivo | Cobertura |
|---|---|---|---|---|---|
| Compositor | Filme ou série e os álbuns do compositor | Créditos do TMDB; o Wikidata liga a pessoa do TMDB (P4985) ao artista do MusicBrainz (P434) | Alto | "Do compositor de Interestelar" | 36,7% dos filmes e 13,2% das séries com ID do TMDB |
| Trilha sonora oficial | Filme e o álbum da trilha | Wikidata (P406); MusicBrainz (tipo Soundtrack) | Alto | "Trilha de Interestelar, que você curtiu" | 1,0% dos filmes |
| Mesma pessoa | Quem atua e também canta | Elenco do TMDB, ligado pelo Wikidata | Alto | "Seu Jorge, de Cidade de Deus, também canta" | Não medida |
| Cinebiografia e filmes sobre música | Filme e o artista retratado | Wikidata (P921); gênero Música do TMDB | Alto | "O filme Elis conta a história de Elis Regina" | 1.208 filmes com músico ou banda como assunto |
| Música-tema | Série e a faixa ou o álbum do tema | Wikidata (P942) | Alto | "O tema de abertura de Twin Peaks" | 206 séries e 146 filmes |
| Movimento cultural | Gênero, década e país de uma geração | Lista curada pela equipe | Médio | "Tropicália e Cinema Novo, a mesma geração" | A montar |
| Lugar | Onde a história se passa e a cidade ou região do artista | Palavras-chave do TMDB e Wikidata; área do artista no MusicBrainz | Médio | "Passa no Rio, como os artistas que você ouve" | Não medida |
| Época retratada | A época da história e a década do álbum | Palavras-chave do TMDB ("1970s") | Médio | "Passa nos anos 70, como estes discos" | Não medida |
| Clima | O vocabulário comum de clima (RNFF09) | Palavras-chave do TMDB; tags do MusicBrainz e do ListenBrainz | Médio | "Mesmo clima melancólico" | Depende do RNFF09 |
| Década de lançamento | A década do filme, da série e do álbum | TMDB; MusicBrainz | Baixo | "Anos 80, como os filmes que você vê" | Quase total |
| País de origem | O país de produção e o país do artista ou do lançamento | TMDB; MusicBrainz | Baixo | "Feito no Brasil" | Quase total |
| Idioma | O idioma original e o idioma do lançamento | TMDB; MusicBrainz | Baixo | "Em coreano, como os doramas que você vê" | Alta |
| Gênero | Uma tabela curta de correspondência, feita à mão (Musical e trilhas; Faroeste, country e folk; Ficção científica e eletrônica) | Equipe | Baixo | "Ficção científica pede eletrônica" | Só os pares da tabela |

- **Regra de corte:** uma ponte de peso baixo sozinha não vira sugestão. A sugestão cruzada exige uma ponte de peso
  alto, ou pelo menos três sinais de peso médio ou baixo juntos ("anos 80, synth e Estados Unidos").
- **Motivo:** mostra a ponte de maior peso; no empate, a mais específica. Na escolha, vale preferir o motivo ligado a
  um registro recente e a uma entidade menos famosa ("do compositor de X" diz mais que "anos 80"), e variar o tipo de
  motivo ao longo do feed. "Em alta" fica por último: no estudo do Spotify (BaRT, RecSys 2018), "porque é popular"
  foi a explicação com pior resultado, e motivos vagos não mudaram a aceitação.
- **Pesos:** começam fixos, como nesta tabela, e passam a ser aprendidos com as aceitações por tipo de ponte
  (RNFF11). Com dezenas de pessoas, os resultados são exploratórios.
- **Cálculo:** offline, numa rotina (RNFF03), a partir do QLever ou dos dumps do Wikidata e do MusicBrainz. O serviço
  público do Wikidata limita as consultas. As ligações são sempre por ID, nunca por nome: buscar "Interstellar" no
  MusicBrainz não traz o álbum do Hans Zimmer entre os três primeiros.
- **Gosto da plataforma:** quando houver pessoas registrando filmes e música, "quem curtiu este filme também curtiu
  este álbum" entra como mais uma fonte na mesma tabela, com peso crescente.
- Cada mídia mantém o próprio feed (D7). As sugestões cruzadas ocupam poucos lugares fixos, e a taxa de aceitação
  delas é medida à parte, por tipo de ponte, no teste A/B.
- Na interface, o "par perfeito" (polaroide do filme e capa do álbum presas pela mesma fita), as seções "Para ouvir
  depois" e "Para ver depois" no detalhe, e o motivo que sempre mostra a ponte.

### O modelo depois do MVP

O recomendador continua híbrido (conteúdo, "quem curtiu X também curtiu Y" e o motivo em cada sugestão), que é o tipo
indicado para poucas pessoas, motivo obrigatório e três mídias com quase nenhuma pessoa em comum nas bases públicas.
Muda o que o alimenta e como ele decide pesos e motivos:

| Passo | Hoje | Depois |
|---|---|---|
| Perfil | Registros, notas e questionário | O mesmo, mais os registros fora do cálculo e o perfil corrigido pela pessoa (RFF07) |
| Conteúdo | TF-IDF com gênero, palavras-chave, direção e década | O mesmo cálculo com mais vocabulário: clima (RNFF09), país e idioma, para achar parecidos entre mídias |
| Gosto parecido | Tabela de vizinhos com o MovieLens, só nos filmes | A mesma tabela com várias fontes: MovieLens, TMDB nas séries, ListenBrainz na música, pontes entre mídias e o diário do próprio Tastory (RNFF06), normalizada por popularidade (RNFF10) |
| Mistura | Pesos fixos no código | Os mesmos pesos no começo, depois aprendidos com as aceitações (RNFF11), com lugares fixos para as sugestões cruzadas e o modo descoberta (RFF16) |
| Motivo | A razão mais forte | As regras da seção acima (recente, específico, variado; "Em alta" por último) e o teste do motivo reescrito por IA (EXP02) |

O cálculo pesado passa a ser feito antes, por rotinas (RNFF03), e o feed só lê o que já foi calculado (RNFF07).

**Decisão aguardando o EXP01.** Há três formas de organizar o conteúdo e as pontes, e a escolha sai da comparação
offline nos filmes do MovieLens, com a mesma divisão de dados e a mesma métrica:

| Forma | Ponto forte | Ponto fraco |
|---|---|---|
| Atual com pontes somadas | Já existe e é fácil de explicar | Cada ponte nova vira mais um sinal com peso próprio |
| *Embeddings* de texto no lugar do TF-IDF | Acha parecidos pelo sentido, inclusive entre mídias | Explica mal sozinho; precisa de texto (o MovieLens só tem título, gênero e tags) |
| Grafo de gosto (títulos, pessoas, gêneros, climas, décadas e países como nós; passeio a partir do gosto) | Um só cálculo para tudo; o caminho vira o motivo; encadeia pontes em até 2 passos | Caminhos longos podem levar a sugestões estranhas; pesos das ligações a calibrar |

O cruzamento entre mídias não tem base pública para medir offline: ele é decidido pelo teste A/B (EXP03).

**Fica de fora:** modelos de áudio (não temos o áudio), redes neurais grandes e recomendação gerada por IA (precisam de
milhões de pessoas ou não dão para conferir). A IA entra no máximo para reescrever o motivo, num teste controlado.

**Retorno das pessoas:** as notas (RFF03), as correções do perfil (RFF07) e o retorno sobre as sugestões (RFF08) deixam o
perfil mais fiel e alimentam os pesos aprendidos. Como o sistema mostra mais do que já foi aceito, o "explorar um pouco"
do RNFF11 e o modo descoberta evitam que ele se feche no óbvio. Com dezenas de pessoas, os resultados são exploratórios.

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

## Requisitos do sistema final

Estes requisitos ficam fora do MVP. Estão na ordem de implementação, agrupados por incremento, e foram renumerados
nessa ordem em 10/11/2026: a coluna "Antes" mostra o número anterior, e a [tabela no fim](#numeração-anterior) mostra
o que aconteceu com cada um. RNFF são não funcionais, e EXP são experimentos de avaliação. Esforço: P até uma semana,
M de 1 a 3 semanas, G várias semanas. Os requisitos entregues no MVP (RF01 a RF26) estão em
[requisitos/funcionais.md](requisitos/funcionais.md).

### Incremento 2: a história do seu gosto em três mídias

Base técnica, música, medição e o Meu gosto. Cumpre a única promessa do pitch que falta.

| ID | Requisito | Situação | Depende de | Esforço | Antes |
|---|---|---|---|---|---|
| RNFF01 | Mudar o banco sem apagar dados, com migrações | Não atende: mudar o modelo exige recriar o banco | — | P | RNFF01 |
| RNFF02 | Respeitar os termos e as licenças das fontes: créditos ao TMDB, à JustWatch, ao Last.fm e ao MusicBrainz, fonte e licença registradas em cada dado, e nenhum dado do TMDB redistribuído | Não atende. Os termos do TMDB restringem o uso com aplicações de ML ou IA e limitam a 6 meses o tempo de guardar dados; o risco foi aceito para o uso acadêmico (ver Riscos no [MVP.md](MVP.md)). Numa versão comercial, é preciso consultar o TMDB e trocar a fonte de conteúdo do recomendador pelo Wikidata. O Last.fm exige contato antes de qualquer uso | — | P | RNFF09 |
| RNFF03 | Rodar em segundo plano, fora das requisições: sincronizar os catálogos, atualizar os dados do TMDB antes de 6 meses e calcular os vizinhos e as pontes entre mídias | Não atende: a sincronização roda dentro da requisição. As pontes saem do QLever ou dos dumps do Wikidata e do MusicBrainz | RNFF01 | M | RNFF04, RNFF08 |
| RNFF04 | Contar a aceitação só quando ela vier até 7 dias depois de a sugestão aparecer | Não atende: Quero ver e Já vi pela página do título contam se o título foi exibido em qualquer momento antes | — | P | RNFF06 |
| RNFF05 | Limitar as tentativas de login | Não atende | — | P | RNFF03 |
| RNFF06 | Usar dados reais na parte colaborativa: MovieLens nos filmes, rota de recomendações do TMDB nas séries e ListenBrainz na música | Parcial: os filmes usam o MovieLens 32M quando a opção está ligada; no servidor publicado, falta carregar. Séries e música ainda não têm fonte | RFF01 (música) | M | RNFF05 |
| RNFF07 | Manter o feed rápido com o catálogo grande, lendo vizinhos já calculados | Não atende: ver as evidências acima. Entra quando o catálogo passar de 10 mil títulos | RNFF03 | M | RNFF02 |
| RFF01 | Registrar álbuns como terceira mídia ([#19](https://github.com/joaolevi/cinematch/issues/19)), com capas, e levar o Meu gosto, a frase do gosto e a retrospectiva para as três mídias | Não implementado: a API só aceita `movie` e `series`. Pronto quando uma amostra de 100 a 200 álbuns brasileiros atingir a cobertura combinada (o pitch fala em ingestão validada sem definir o critério) | RNFF01, RNFF03 | G | RFF01, RFF26 |
| RFF02 | Recomendar música a partir dos álbuns registrados no diário, em feed próprio e com o motivo em cada sugestão | Não implementado | RFF01 | M | RFF02 |
| RFF03 | Pedir a nota na hora certa: lembrete no Início para títulos vistos sem nota, estrelas clicáveis na polaroide do diário e "Já viu?" para o Quero ver depois de alguns dias | Não implementado. A nota continua opcional: obrigatória, viraria clique aleatório e enganaria o recomendador | — | P | RFF14 |
| RFF04 | Ver no painel a taxa de satisfação: das sugestões aceitas que ganharam nota, quantas ficaram com 3,5 ou mais | Não implementado no painel. A consulta está no [roteiro do teste interno](HOMOLOGACAO.md#análise-bárbara) | — | P | RFF15 |
| RFF05 | Ver a retrospectiva do gosto por mês e por ano: títulos mais vistos e mais bem avaliados, gêneros, décadas, a frase do gosto, a idade do gosto e um arquétipo, com um cartão para compartilhar | Não implementado: reaproveita os dados e os gráficos do Meu gosto (RF23) | — | P a M | RFF17, RFF37 |
| RFF06 | Excluir a própria conta e exportar os próprios dados | Parcial: o admin já apaga uma conta com tudo o que é dela (RF26). Falta a própria pessoa excluir e exportar | — | P | RFF07, parte do RFF38 |
| EXP01 | Comparar offline, nos filmes do MovieLens, o modelo atual, o mesmo com *embeddings* e o grafo de gosto; fica o que ganhar (ver [O modelo depois do MVP](#o-modelo-depois-do-mvp)) | Não feito. Usa o `backend/scripts/evaluate_recommender.py` | — | M | novo |

### Incremento 3: beta aberta, social e controle

Preparar a abertura para pessoas de fora, o social mínimo e o controle sobre o próprio gosto.

| ID | Requisito | Situação | Depende de | Esforço | Antes |
|---|---|---|---|---|---|
| RNFF08 | Cumprir a LGPD: consentimento para os experimentos, política de privacidade e direitos sobre os dados | Não atende. Precisa estar pronto antes de abrir a beta | — | P a M | novo |
| RFF07 | Ver e corrigir o próprio perfil de gosto, numa página que mostra o que o Tastory acha do seu gosto: mais ou menos de um gênero, uma época ou uma pessoa, e registros que não contam no cálculo | Não implementado: hoje o perfil só existe dentro do recomendador | RNFF01 | M | parte do RFF18, RFF32 |
| RFF08 | Dar retorno sobre uma sugestão ("não por esse motivo", "mais curto", "menos famoso", "mais leve") e receber um novo lote | Não implementado: hoje o motivo só informa (RF13), e o descarte vale para um título (RF10). O "mais leve" depende do RNFF09 | RFF07 | M | parte do RFF18, RFF34 |
| RFF09 | Seguir e deixar de seguir pessoas, e filtrar a Comunidade por quem sigo | Não implementado: precisa de uma tabela nova | RNFF01 | M | RFF10 |
| RFF10 | Escolher quem vê meus registros: todos, quem me segue ou ninguém | Não implementado: no MVP, todo mundo vê todo mundo | RFF09 | P a M | RFF11 |
| RFF11 | Ver a página de perfil, com a história do gosto ([#16](https://github.com/joaolevi/cinematch/issues/16)) | Parcial: o diário já mostra a frase do gosto, os números e os gráficos (RF23), e o avatar abre o menu da pessoa. Falta o perfil que outras pessoas veem, ao clicar no nome na Comunidade | RFF10 | M | RFF08 |
| RFF12 | Registrar o mesmo título mais de uma vez, preservando notas, datas e resenhas anteriores | Não implementado. **Substitui a RN05:** hoje rever um filme apaga o registro anterior | RNFF01 | M | RFF03 |
| RFF13 | Buscar e adicionar qualquer título, sem depender do admin | Parcial: o admin já busca e importa do TMDB; falta a própria pessoa poder fazer isso, com limite de uso | — | P | RFF04 |
| RFF14 | Recuperar a senha e verificar o e-mail | Não implementado. Pede decidir sobre os e-mails fictícios aceitos hoje e o custo de envio | RNFF01 | M | RFF06 |
| RFF15 | Ver a compatibilidade de gosto com outra pessoa ("vocês combinam 72%"), com o que têm em comum e onde divergem, e receber sugestões de quem seguir por gosto parecido | Não implementado. Usa o mesmo cálculo de parecidos do recomendador | RFF11 | P a M | RFF30, RFF41 |
| RFF16 | Escolher o modo descoberta em três opções, com o rótulo "Fora da sua bolha" nas sugestões menos óbvias | Não implementado | — | P | RFF36 |
| RFF17 | Ler a página "Como recomendamos", em português simples, com a opção de sair dos experimentos | Não implementado | RNFF08 | P | parte do RFF38 |
| RFF18 | Importar o histórico de outros apps, como Letterboxd e TV Time, a partir do arquivo exportado pela pessoa | Não implementado; **prioridade a definir pela equipe**. Os termos do Letterboxd proíbem coleta automática | RFF12, RFF13, RFF01 | M | RFF39 |
| EXP02 | Comparar, num teste A/B, o motivo escrito por modelo fixo com o mesmo motivo reescrito por IA | Não feito. Depende de guardar o motivo de forma estruturada e de orçamento | RNFF02 | P a M | RFF33 |

### Incremento 4: clima, momento e onde assistir

O vocabulário de clima e tudo que depende dele, mais os serviços de streaming.

| ID | Requisito | Situação | Depende de | Esforço | Antes |
|---|---|---|---|---|---|
| RNFF09 | Ter um vocabulário de clima comum a filmes, séries e música: cerca de 20 a 25 rótulos em pt-BR, com as palavras-chave do TMDB e as tags de música ligadas a eles | Não atende | RNFF02 | M a G | RNFF07 |
| RFF19 | Ver onde assistir ou ouvir cada título, por país, com link para o serviço: no detalhe, os serviços em três grupos (assinatura, aluguel e compra); no card do feed, os logos dos serviços | Não implementado. Filmes e séries: a rota de provedores do TMDB, guardada junto do título e atualizada toda semana, exige exibir "Dados de disponibilidade: JustWatch"; sem API pública dos serviços, o link abre a página do título no TMDB ou a busca do serviço. Música: os IDs do Spotify e do Deezer vêm das ligações do MusicBrainz e do Wikidata; na falta, a busca pública do Deezer e a do iTunes; o YouTube Music abre pela busca. A API do Spotify fica de fora: em 2026, o modo de desenvolvimento aceita 5 pessoas e exige Premium | RNFF03; RFF01 (música) | M a G | RFF19 |
| RFF20 | Pedir sugestões pelo momento: tom (leve ou intenso), duração máxima e ocasião, com o atalho "Hoje à noite" que junta o momento, os seus serviços e, se quiser, outra pessoa | Não implementado: o TMDB tem a duração; o tom vem do vocabulário de clima. O "Hoje à noite" com outra pessoa vem com o RFF28 | RNFF09 | M | RFF21, RFF29 |
| RFF21 | Marcar os serviços que assina e filtrar o Para você por "só o que eu tenho"; o motivo pode citar o serviço ("está na sua Netflix") | Não implementado | RFF19 | P a M | RFF27 |
| RFF22 | Ordenar o Quero ver pelo que mais combina agora, juntando o gosto, a disponibilidade nos seus serviços e o momento | Não implementado | RFF19, RFF20 | P a M | RFF31 |
| RFF23 | Buscar por clima ("melancólico", "épico", "leve") e receber filmes, séries e álbuns juntos | Não implementado | RNFF09, RFF01 | M | RFF25 |
| RFF24 | Acompanhar séries por temporada e com o estado "assistindo" | Não implementado | RFF12 | M | RFF05 |
| RFF25 | Pedir sugestões em português, com expressões brasileiras ("algo para a Sessão da Tarde"), que viram os filtros do RFF20 | Não implementado. A IA só interpreta o pedido; quem recomenda continua sendo o recomendador. Precisa de orçamento | RFF20, RNFF09 | M | RFF35 |

### Incremento 5: pontes entre mídias e grupo

As sugestões que cruzam filmes, séries e música, e assistir ou ouvir junto.

| ID | Requisito | Situação | Depende de | Esforço | Antes |
|---|---|---|---|---|---|
| RNFF10 | Calcular os vizinhos de coocorrência sem que os títulos muito populares dominem (normalização por popularidade) | Não atende: hoje a similaridade colaborativa é o cosseno simples | RNFF06 | P a M | RNFF11 |
| RFF26 | Ver no detalhe do título as ligações com outras mídias, nas seções "Para ouvir depois" e "Para ver depois": trilha sonora, compositor, quem atua e também canta, cinebiografias e documentários | Não implementado. Começa por compositor e trilha, as pontes com cobertura medida (esforço M nessa versão) | RFF01, RNFF03 | G | RFF22, RFF24 |
| RFF27 | Receber no Para você sugestões de outra mídia, como o par filme e álbum, sempre com a ponte no motivo e em lugares fixos | Não implementado | RFF26, RNFF09 | G | RFF09, RFF23 |
| RFF28 | Receber sugestões para assistir ou ouvir junto, combinando o gosto de duas ou mais pessoas | Não implementado | RFF15 | M | RFF20 |
| EXP03 | Medir, no teste A/B, a aceitação das sugestões cruzadas por tipo de ponte | Não feito | RFF27 | P | novo |

### Depois: com dados reais ou folga

O fim das cadeias de dependência e o que precisa de muitas aceitações reais.

| ID | Requisito | Situação | Depende de | Esforço | Antes |
|---|---|---|---|---|---|
| RNFF11 | Aprender com as aceitações quanto pesa cada fonte, cada ponte e cada tipo de motivo, testando um pouco de cada um (explorar e aproveitar) | Não atende: os pesos são fixos no código. Usa os eventos de exibição e aceitação que já existem, guardando a probabilidade de cada escolha. Inspirado no BaRT, do Spotify. Até haver aceitações suficientes, os pesos ficam fixos | EXP03 | M | RNFF10 |
| RFF29 | Receber um aviso no Início quando um título do Quero ver entrar em um dos seus serviços | Não implementado. O aviso de que vai sair fica como extensão: não há fonte gratuita que cubra a Globoplay | RFF21 | M | RFF28 |
| RFF30 | Curtir e comentar resenhas na Comunidade, com moderação dos comentários e o rank de quem escreve, pelas curtidas recebidas | Não implementado: precisa de tabelas novas. Hoje a Comunidade só conta as resenhas | RNFF01 | M | RFF12, RFF13 |
| RFF31 | Ver o próprio histórico de atividades, em ordem de data e com filtro por tipo: registros, notas, resenhas, itens adicionados a listas, curtidas e pessoas seguidas | Não implementado. Quem vê o histórico de outra pessoa segue o RFF10 | RFF09, RFF30, RFF10 | M | RFF16 |
| RFF32 | Ver o tema do mês: uma prateleira curada e um desafio com selo, como "Feito em Alagoas" | Não implementado. Usa as listas que já existem | — | P a M | RFF40, RFF42 |

### Numeração anterior

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
| — | RNFF08 | Novo |
