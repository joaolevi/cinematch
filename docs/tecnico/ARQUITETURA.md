# Arquitetura e sistema final

> **Versão 4, 10/11/2026.** Requisitos do sistema final renumerados na ordem de implementação; resultado do EXP01 e incremento 2 dividido em 2a e 2b. Validação técnica: Bárbara (IA) e Levi (TL). Aprovação: Sophia (GP).
> Este documento trata do sistema final, com filmes, séries e música. O MVP, entregue em 10/11/2026, está em [MVP.md](../gestao/MVP.md).

## Decisões

| ID | Decisão | Motivo | Quem aprovou |
|---|---|---|---|
| D7 | Filmes e séries são recomendados juntos; música é recomendada separadamente | Filmes e séries já compartilham gêneros, diretores e dados. Cruzar com música exige pessoas que consomem as duas coisas, e ainda não temos esses dados | Sophia (GP), 06/11 |
| D8 | O MVP mantém o cálculo atual; a mudança de arquitetura fica para depois de 10/11. As exceções são a tabela de vizinhos do MovieLens (D14) e o ajuste nas séries (D16) | Com o catálogo atual, o feed responde em milissegundos, e trocar agora colocaria a entrega em risco | Sophia (GP), 06/11 |
| D14 | Os vizinhos do MovieLens 32M substituem os usuários inventados nos filmes, com a opção desligada por padrão | Foi a maior melhora medida, e a opção desligada protege a entrega | Sophia (GP), 06/11 |
| D22 | Os filmes mantêm o híbrido atual; séries, música e pontes entre mídias usam o grafo no lado do conteúdo (RNFF12) | No EXP01, com dados colaborativos os modelos empataram, e só com conteúdo o grafo venceu o TF-IDF | Sophia (GP), 10/11 |
| D23 | O incremento 2 se divide em 2a (base, medição e grafo) e 2b (música) | A música (RFF01) é o único item grande e travaria o resto; o 2a já entrega melhora visível | Sophia (GP), 10/11 |
| D24 | O grupo B passa a usar o grafo de conteúdo quando o RNFF12 estiver pronto; a contagem do A/B no painel recomeça nessa data | O A/B continua comparando completo com só conteúdo, agora com o conteúdo melhor; os números de antes e de depois não se comparam | Sophia (GP), 10/11 |
| D25 | O banco muda só por migrações do Alembic, aplicadas pela própria API ao subir. Um banco criado antes delas é adotado na versão 0001 se conferir com o banco do MVP; se não conferir, a API não sobe (RNFF01) | Sem migrações, toda coluna nova obrigava a recriar o banco ou a rodar `ALTER TABLE` à mão no servidor. Adotar sozinho poupa o passo manual no deploy, e recusar o que não confere evita marcar um banco errado | Sophia (GP), 10/11 |

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

**As três formas comparadas no EXP01:**

| Forma | Ponto forte | Ponto fraco |
|---|---|---|
| Atual com pontes somadas | Já existe e é fácil de explicar | Cada ponte nova vira mais um sinal com peso próprio |
| *Embeddings* de texto no lugar do TF-IDF | Acha parecidos pelo sentido, inclusive entre mídias | Explica mal sozinho; precisa de texto (o MovieLens só tem título, gênero e tags) |
| Grafo de gosto (títulos, pessoas, gêneros, climas, décadas e países como nós; passeio a partir do gosto) | Um só cálculo para tudo; o caminho vira o motivo; encadeia pontes em até 2 passos | Caminhos longos podem levar a sugestões estranhas; pesos das ligações a calibrar |

**Resultado do EXP01 (10/11/2026):** com dados colaborativos, as três formas empataram; só com conteúdo, o grafo venceu
o TF-IDF (NDCG@20 de 0,058 contra 0,022). Os números e como repetir estão em [AVALIACAO.md](AVALIACAO.md#resultado-do-exp01).

**Decisão:** os filmes mantêm o híbrido atual, com peso 0,2 no conteúdo quando houver MovieLens. Séries, música e
pontes entre mídias usam o grafo no lado do conteúdo, e as pontes viram ligações do grafo, com o caminho mais forte
como motivo. Os *embeddings* ficam de fora. O bônus de popularidade não muda por causa deste teste: testes offline
favorecem os populares, e quem decide é o A/B, junto com a satisfação. Limites: base pequena, 27 pessoas no corte usado
para escolher os parâmetros (o melhor amortecimento do grafo variou entre 0,5 e 0,85) e uma rodada só. O EXP04
confirma o resultado no MovieLens 32M.

Na prática, o grafo vira o RNFF12, no incremento 2a, porque séries, música e grupo B já ganham com ele (D22). O grupo B
passa a usá-lo, e a contagem do A/B recomeça na data da troca (D24).

O cruzamento entre mídias não tem base pública para medir offline: ele é decidido pelo teste A/B (EXP03).

**Fica de fora:** modelos de áudio (não temos o áudio), redes neurais grandes e recomendação gerada por IA (precisam de
milhões de pessoas ou não dão para conferir). A IA entra no máximo para reescrever o motivo, num teste controlado.

**Retorno das pessoas:** as notas (RFF03), as correções do perfil (RFF07) e o retorno sobre as sugestões (RFF08) deixam o
perfil mais fiel e alimentam os pesos aprendidos. Como o sistema mostra mais do que já foi aceito, o "explorar um pouco"
do RNFF11 e o modo descoberta evitam que ele se feche no óbvio. Com dezenas de pessoas, os resultados são exploratórios.

## Evidências e fontes avaliadas

Os testes de carga e de qualidade, a comparação de fontes de dados e os experimentos estão em
[AVALIACAO.md](AVALIACAO.md).

## Requisitos do sistema final

Os requisitos fora do MVP estão por tipo em [funcionais.md](../requisitos/funcionais.md#futuros) e
[nao-funcionais.md](../requisitos/nao-funcionais.md#futuros), e a visão geral por incremento, em
[incrementos.md](../requisitos/incrementos.md).
