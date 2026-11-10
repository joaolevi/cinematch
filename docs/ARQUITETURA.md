# Arquitetura e sistema final

> **Versão 2, 06/11/2026.** Validação técnica: Bárbara (IA) e Levi (TL). Aprovação: Sophia (GP).
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
| Música | ListenBrainz | Dados abertos; a similaridade por álbum ainda precisa ser confirmada |
| Entre mídias | Interações da própria plataforma | Só funciona com usuários reais |

### Recomendação entre mídias

Quase não há base pública com as mesmas pessoas avaliando filmes e música (por isso a D7). A saída é ligar as
mídias por pontes, em três camadas, da mais barata para a que depende de dados:

| Camada | Como liga as mídias | Fonte | Exemplo de motivo |
|---|---|---|---|
| 1. Pontes explícitas | Trilha sonora, compositor, artista no elenco, cinebiografia | Wikidata e MusicBrainz | "Trilha de Interestelar, que você curtiu" |
| 2. Clima e tema | Um vocabulário comum: clima (sombrio, leve, nostálgico, épico), década, país e temas | Palavras-chave do TMDB; tags de música do Last.fm, do MusicBrainz e do ListenBrainz | "Mesmo clima sombrio dos anos 80" |
| 3. Gosto da plataforma | Quem registra as duas mídias no diário: "quem curtiu este filme também curtiu este álbum" | O próprio Tastory | "Quem curtiu Twin Peaks também ouviu…" |

- A camada 2 traduz as palavras-chave e as tags para o mesmo vocabulário. Assim, o cálculo de conteúdo atual
  (TF-IDF) passa a achar parecidos entre mídias.
- As camadas 1 e 3 entram na tabela de vizinhos como fontes novas, ao lado do MovieLens.
- Cada mídia mantém o próprio feed (D7). As sugestões cruzadas ocupam poucos lugares fixos, e a taxa de aceitação
  delas é medida à parte, no teste A/B.
- Ordem: camada 1, depois 2; a camada 3 ganha peso conforme o diário cresce.
- Na interface, o "par perfeito" (polaroide do filme e capa do álbum presas pela mesma fita), as seções "Para ouvir
  depois" e "Para ver depois" no detalhe, e o motivo que sempre mostra a ponte.

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
| Last.fm | Tags de álbuns e artistas, artistas e faixas parecidos, histórico público de quem usa | Candidato para as tags de clima e para os artistas parecidos na música; uso não comercial, com atribuição |
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

Estes requisitos ficam fora do MVP.

### Funcionais

| ID | Requisito | Situação |
|---|---|---|
| RFF01 | Registrar álbuns como terceira mídia ([#19](https://github.com/joaolevi/cinematch/issues/19)) | Não implementado: a API só aceita `movie` e `series` |
| RFF02 | Recomendar música a partir do que a pessoa ouve | Não implementado |
| RFF03 | Registrar o mesmo título mais de uma vez, preservando notas, datas e resenhas anteriores | **Substitui a RN05:** hoje rever um filme apaga o registro anterior |
| RFF04 | Buscar e adicionar qualquer título, sem depender do admin | Não implementado: a busca externa é só para admin |
| RFF05 | Acompanhar séries por temporada e com o estado "assistindo" | Não implementado |
| RFF06 | Recuperar a senha e verificar o e-mail | Não implementado |
| RFF07 | Excluir a própria conta e os dados pessoais | Parcial: o admin já apaga uma conta com tudo o que é dela (RF26). Falta a própria pessoa fazer isso |
| RFF08 | Ver a página de perfil, com a história do gosto ([#16](https://github.com/joaolevi/cinematch/issues/16)) | Parcial: o diário já mostra a frase do gosto, os números e os gráficos (RF23), e o avatar abre o menu da pessoa. Falta o perfil que outras pessoas veem, ao clicar no nome na Comunidade |
| RFF10 | Seguir e deixar de seguir pessoas, e filtrar a Comunidade por quem sigo | Não implementado: precisa de uma tabela nova |
| RFF11 | Escolher quem vê meus registros: todos, quem me segue ou ninguém | Não implementado: no MVP, todo mundo vê todo mundo |
| RFF12 | Curtir e comentar resenhas na Comunidade, com moderação dos comentários | Não implementado: precisa de tabelas novas |
| RFF13 | Ver o rank de reviewers, com base nas curtidas recebidas | Depende do RFF12. Hoje, a Comunidade só conta as resenhas |
| RFF14 | Pedir a nota na hora certa: lembrete no Início para títulos vistos sem nota, estrelas clicáveis na polaroide do diário e "Já viu?" para o Quero ver depois de alguns dias | Não implementado. A nota continua opcional: obrigatória, viraria clique aleatório e enganaria o recomendador, que hoje trata "Já vi" sem nota como "gostou mais ou menos" |
| RFF15 | Ver no painel a taxa de satisfação: das sugestões aceitas que ganharam nota, quantas ficaram com 3,5 ou mais | Não implementado no painel. A consulta está no [roteiro do teste interno](HOMOLOGACAO.md#análise-bárbara) |
| RFF09 | Receber recomendações cruzadas entre filmes e música | Evolução, depende de dados da plataforma |
| RFF16 | Ver o próprio histórico de atividades, em ordem de data e com filtro por tipo: títulos registrados, notas, resenhas, itens adicionados a listas e, quando existirem, curtidas e pessoas seguidas | Não implementado: hoje o diário mostra os registros, mas não as listas, curtidas ou quem a pessoa segue. Precisa de uma tabela de eventos de atividade. Depende do RFF10 e do RFF12; quem vê o histórico de outra pessoa segue o RFF11 |
| RFF17 | Ver a retrospectiva do gosto por mês e por ano: títulos mais vistos e mais bem avaliados, gêneros, décadas e a frase do gosto, com uma versão para compartilhar | Não implementado: reaproveita os dados e os gráficos do Meu gosto (RF23) |
| RFF18 | Reagir ao motivo de uma sugestão ("não quero mais por esse motivo") e ajustar o próprio perfil (mais ou menos de um gênero, uma época ou uma pessoa), numa página que mostra o que o Tastory acha do seu gosto, com efeito nas próximas sugestões | Não implementado: hoje o motivo só informa (RF13), e o descarte vale para um título (RF10) |
| RFF19 | Ver onde assistir ou ouvir cada título, por país, com link para o serviço: no detalhe, os serviços em três grupos (assinatura, aluguel e compra); no card do feed, os logos dos serviços | Não implementado. Filmes e séries: a rota de provedores do TMDB, guardada junto do título e atualizada toda semana, exige exibir "Dados de disponibilidade: JustWatch"; sem API pública dos serviços, o link abre a página do título no TMDB ou a busca do serviço. Música: a busca do Deezer devolve o link do álbum sem login; a do Spotify exige registrar o app; o YouTube Music abre pela busca |
| RFF20 | Receber sugestões para assistir ou ouvir junto, combinando o gosto de duas ou mais pessoas | Não implementado. Depende do RFF10 |
| RFF21 | Pedir sugestões pelo momento: tom (leve ou intenso), duração máxima e ocasião | Não implementado: o TMDB tem a duração; o tom precisa ser derivado das palavras-chave e dos gêneros |
| RFF22 | Ver a trilha do que viu: para cada filme ou série do diário, a trilha sonora, o compositor e os álbuns dele; ao registrar um título, o Tastory sugere a trilha | Não implementado. Depende do RFF01. Ponte explícita entre mídias (Wikidata e MusicBrainz) |
| RFF23 | Receber uma sessão completa: um filme ou uma série e um álbum para depois, no mesmo clima | Não implementado. Depende do RFF01 e do vocabulário de clima (camada 2 abaixo) |
| RFF24 | Descobrir pessoas que atravessam mídias: cinebiografias e documentários dos artistas que a pessoa ouve, e álbuns de quem atua nos filmes e séries que ela vê | Não implementado. Depende do RFF01. Ponte explícita entre mídias |
| RFF25 | Buscar por clima ("melancólico", "épico", "leve") e receber filmes, séries e álbuns juntos | Não implementado. Depende do vocabulário de clima (camada 2 abaixo) |
| RFF26 | Ver o gosto unificado: a frase do gosto, o Meu gosto e a retrospectiva cruzando filmes, séries e música | Não implementado. Depende do RFF01 e do RFF17 |
| RFF27 | Marcar os serviços que assina e filtrar o Para você por "só o que eu tenho"; o motivo pode citar o serviço ("está na sua Netflix") | Não implementado. Depende do RFF19 |
| RFF28 | Receber um aviso no Início quando um título do Quero ver entrar em um dos seus serviços ou estiver para sair | Não implementado. Depende do RFF19 e do RFF27 |
| RFF29 | Pedir uma sugestão para "hoje à noite", combinando o momento, os seus serviços e, se quiser, outra pessoa | Não implementado. Depende do RFF20, do RFF21 e do RFF27 |
| RFF30 | Ver a compatibilidade de gosto com outra pessoa ("vocês combinam 72%"), com o que têm em comum e onde divergem | Não implementado. Usa o mesmo cálculo de títulos parecidos do recomendador; prepara o RFF20 |
| RFF31 | Ordenar o Quero ver pelo que mais combina agora, juntando o gosto, a disponibilidade nos seus serviços e o momento | Não implementado. Depende do RFF19 e do RFF21 para a disponibilidade e o momento |

### Não funcionais

| ID | Requisito | Situação |
|---|---|---|
| RNFF01 | Mudar o banco sem apagar dados, com migrações | Não atende: mudar o modelo exige recriar o banco |
| RNFF02 | Tempo e memória do feed não dependem do tamanho do catálogo | Não atende: ver as evidências acima |
| RNFF03 | Limitar tentativas de login | Não atende |
| RNFF04 | Sincronizar catálogos em segundo plano | Não atende: a sincronização roda dentro da requisição |
| RNFF05 | Usar dados reais na parte colaborativa | Parcial: filmes usam o MovieLens 32M quando a opção está ligada; séries e música ainda não têm fonte |
| RNFF06 | Atribuir a aceitação a uma exibição recente | Não atende: Quero ver e Já vi pela página do título contam se o título foi exibido no feed em qualquer momento antes. Falta uma janela de tempo (por exemplo, 7 dias) |
