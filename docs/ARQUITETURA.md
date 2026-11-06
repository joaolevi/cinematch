# Arquitetura e sistema final

> **Versão 1, 06/11/2026.** Validação técnica: Bárbara (IA) e Levi (TL). Aprovação: Sophia (GP).
> Este documento trata do sistema final, com filmes, séries e música. O que será entregue em 10/11 está em [MVP.md](MVP.md).

## Decisões

| ID | Decisão | Motivo | Quem aprovou |
|---|---|---|---|
| D7 | Filmes e séries são recomendados juntos; música é recomendada separadamente | Filmes e séries já compartilham gêneros, diretores e dados. Cruzar com música exige pessoas que consomem as duas coisas, e ainda não temos esses dados | Sophia (GP), 06/11 |
| D8 | O MVP mantém o cálculo atual; a mudança de arquitetura fica para depois de 10/11 | Com o catálogo atual, o feed responde em milissegundos, e trocar agora colocaria a entrega em risco | Sophia (GP), 06/11 |

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
| Filmes | MovieLens e TMDB | O MovieLens liga cada filme ao ID do TMDB. A licença proíbe uso comercial sem permissão |
| Séries | TMDB | O MovieLens só tem filmes |
| Música | ListenBrainz | Dados abertos; a similaridade por álbum ainda precisa ser confirmada |
| Entre mídias | Interações da própria plataforma | Só funciona com usuários reais |

## Evidências

Testes feitos em 05 e 06/11/2026. Para repetir o teste de qualidade, baixe o
[MovieLens](https://grouplens.org/datasets/movielens/latest/) e rode
`python -m scripts.avaliar_recomendador <pasta-do-ml-latest-small>` a partir de `backend/`.

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
| RFF07 | Excluir a própria conta e os dados pessoais | Não implementado |
| RFF08 | Ver a página de perfil, com a história do gosto ([#16](https://github.com/joaolevi/cinematch/issues/16)) | Não implementado |
| RFF09 | Receber recomendações cruzadas entre filmes e música | Evolução, depende de dados da plataforma |

### Não funcionais

| ID | Requisito | Situação |
|---|---|---|
| RNFF01 | Mudar o banco sem apagar dados, com migrações | Não atende: mudar o modelo exige recriar o banco |
| RNFF02 | Tempo e memória do feed não dependem do tamanho do catálogo | Não atende: ver as evidências acima |
| RNFF03 | Limitar tentativas de login | Não atende |
| RNFF04 | Sincronizar catálogos em segundo plano | Não atende: a sincronização roda dentro da requisição |
| RNFF05 | Usar dados reais na parte colaborativa | Não atende: hoje depende de 30 usuários inventados |
