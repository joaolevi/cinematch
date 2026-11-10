# Requisitos funcionais

> [Voltar ao índice](README.md) · A ligação com código e testes está no fim deste arquivo.

As situações dos requisitos do MVP consideram a versão entregue, que está na `main` com a tag `entrega-10-11` ([#35](https://github.com/joaolevi/cinematch/pull/35)).

## Acesso

| ID | Requisito | Situação | MVP |
|---|---|---|---|
| RF01 | Cadastrar conta com nome, e-mail e senha | Atende | Deve |
| RF02 | Entrar com e-mail e senha e receber um token válido por 24 h | Atende | Deve |
| RF03 | Escolher gêneros, épocas, diretores e títulos favoritos em um onboarding opcional de três passos | Atende | Deve |
| RF25 | Ver, antes de entrar, uma apresentação do sistema: o que é, como funciona e o aviso de que os registros aparecem na Comunidade | Atende | Deve |

## Uso geral

| ID | Requisito | Situação | MVP |
|---|---|---|---|
| RF04 | Buscar por título, criador, ator ou tag, filtrar por tipo e gênero e ordenar, vendo o que a pessoa já viu | Atende | Deve |
| RF05 | Ver o detalhe de um título: dados, elenco, nota média, resenhas e status do usuário | Atende | Deve |
| RF06 | Registrar que viu um título, com data opcional, de qualquer tela pelo botão Registrar, e editar ou apagar o registro | Atende | Deve |
| RF07 | Dar nota e escrever resenha, ambas opcionais | Atende | Deve |
| RF08 | Criar, renomear e excluir listas, incluir e remover títulos e usar a watchlist "Quero ver" | Atende | Deve |
| RF09 | Ver o feed "Para você", com filtro por tipo, botão "Ver mais sugestões" e opção de trocar as sugestões | Atende | Deve |
| RF10 | Reagir a uma sugestão com Quero ver, Já vi ou Não me interesso, que pode ser desfeito | Atende | Deve |
| RF19 | Ver no diário, na aba Meu gosto, o top 10 dos títulos mais amados e o dos mais odiados | Atende | Deve |
| RF20 | Ver a página Comunidade, com os registros mais recentes de todas as pessoas (pessoa, título, nota, resenha e quando a pessoa viu) e com quem mais escreve resenhas | Atende | Deve |
| RF21 | Ver títulos parecidos no detalhe, sem o que a pessoa já viu, descartou ou guardou | Atende | Deve |
| RF22 | Explorar por gênero, diretor, criador e ator: clicar no detalhe abre a Busca filtrada, com endereço próprio | Atende | Deve |
| RF23 | Ver o próprio gosto no diário: uma frase que resume o gosto, números do diário e gráficos de gêneros, décadas, notas, filmes e séries e de quem dirige ou cria o que a pessoa mais vê, por período, com clique que filtra a linha do tempo | Atende | Deve |
| RF24 | Ver a página Início, que reúne a aposta do dia, a lista Quero ver, o que está em alta, um pedaço do diário, a Comunidade e os lançamentos | Atende | Deve |

## Inteligência

| ID | Requisito | Situação | MVP |
|---|---|---|---|
| RF11 | Gerar sugestões a partir do histórico e das preferências (grupo A: híbrido; grupo B: só conteúdo) | Atende | Deve |
| RF12 | Mostrar títulos em alta para quem não tem histórico nem preferências | Atende | Deve |
| RF13 | Mostrar em cada sugestão um motivo em texto, como um título do histórico, um gênero preferido ou "Em alta" | Atende | Deve |

## Administração

| ID | Requisito | Situação | MVP |
|---|---|---|---|
| RF14 | Admin cria, edita e remove títulos | Atende | Deve |
| RF15a | Admin sincroniza o catálogo mockado, sem internet | Atende | Deve |
| RF15b | Admin sincroniza, busca e importa títulos do TMDB real | Atende: os 13 testes com o TMDB real passaram em 06/11 | Deve |
| RF16 | Admin lista, oculta e restaura resenhas | Atende | Deve |
| RF17 | Admin vê a taxa de aceitação geral e por grupo A/B, explicada em frases | Atende | Deve |
| RF26 | Admin vê as pessoas cadastradas (reais e simuladas, à parte), o que cada uma fez, e apaga uma conta com tudo o que é dela | Atende | Deve |

## Interface

| ID | Requisito | Situação | MVP |
|---|---|---|---|
| RF18 | Interface web para os fluxos acima | Atende: fluxo completo testado no navegador | Deve |

## Futuros

Fora do MVP, na ordem de implementação. A visão geral por incremento está em [incrementos.md](incrementos.md), e o
número anterior de cada requisito, renumerado em 10/11/2026, aparece na coluna "Antes". Esforço: P até uma semana, M de 1
a 3 semanas, G várias semanas. Ao mudar a situação de um requisito, atualize também a linha dele em incrementos.md.

| ID | Requisito | Situação | Depende de | Esforço | Incremento | Antes |
|---|---|---|---|---|---|---|
| <a id="rff03"></a>RFF03 | Pedir a nota na hora certa: lembrete no Início para títulos vistos sem nota, estrelas clicáveis na polaroide do diário e "Já viu?" para o Quero ver depois de alguns dias | Não implementado. A nota continua opcional: obrigatória, viraria clique aleatório e enganaria o recomendador | — | P | 2a | RFF14 |
| <a id="rff04"></a>RFF04 | Ver no painel a taxa de satisfação: das sugestões aceitas que ganharam nota, quantas ficaram com 3,5 ou mais | Não implementado no painel. A consulta está no [roteiro de teste com pessoas](../gestao/HOMOLOGACAO.md#análise-bárbara) | — | P | 2a | RFF15 |
| <a id="rff01"></a>RFF01 | Registrar álbuns como terceira mídia ([#19](https://github.com/joaolevi/cinematch/issues/19)), com capas, e levar o Meu gosto, a frase do gosto e a retrospectiva para as três mídias | Não implementado: a API só aceita `movie` e `series`. Pronto quando uma amostra de 100 a 200 álbuns brasileiros atingir a cobertura combinada (o pitch fala em ingestão validada sem definir o critério) | RNFF01, RNFF03 | G | 2b | RFF01, RFF26 |
| <a id="rff02"></a>RFF02 | Recomendar música a partir dos álbuns registrados no diário, em feed próprio e com o motivo em cada sugestão | Não implementado. O conteúdo vem do grafo (RNFF12), porque a música começa sem dados colaborativos | RFF01, RNFF12 | M | 2b | RFF02 |
| <a id="rff05"></a>RFF05 | Ver a retrospectiva do gosto por mês e por ano: títulos mais vistos e mais bem avaliados, gêneros, décadas, a frase do gosto, a idade do gosto e um arquétipo, com um cartão para compartilhar | Não implementado: reaproveita os dados e os gráficos do Meu gosto (RF23) | — | P a M | 2b | RFF17, RFF37 |
| <a id="rff06"></a>RFF06 | Excluir a própria conta e exportar os próprios dados | Parcial: o admin já apaga uma conta com tudo o que é dela (RF26). Falta a própria pessoa excluir e exportar | — | P | 2b | RFF07, parte do RFF38 |
| <a id="rff07"></a>RFF07 | Ver e corrigir o próprio perfil de gosto, numa página que mostra o que o Tastory acha do seu gosto: mais ou menos de um gênero, uma época ou uma pessoa, e registros que não contam no cálculo | Não implementado: hoje o perfil só existe dentro do recomendador | RNFF01 | M | 3 | parte do RFF18, RFF32 |
| <a id="rff08"></a>RFF08 | Dar retorno sobre uma sugestão ("não por esse motivo", "mais curto", "menos famoso", "mais leve") e receber um novo lote | Não implementado: hoje o motivo só informa (RF13), e o descarte vale para um título (RF10). O "mais leve" depende do RNFF09 | RFF07 | M | 3 | parte do RFF18, RFF34 |
| <a id="rff09"></a>RFF09 | Seguir e deixar de seguir pessoas, e filtrar a Comunidade por quem sigo | Não implementado: precisa de uma tabela nova | RNFF01 | M | 3 | RFF10 |
| <a id="rff10"></a>RFF10 | Escolher quem vê meus registros: todos, quem me segue ou ninguém | Não implementado: no MVP, todo mundo vê todo mundo | RFF09 | P a M | 3 | RFF11 |
| <a id="rff11"></a>RFF11 | Ver a página de perfil, com a história do gosto ([#16](https://github.com/joaolevi/cinematch/issues/16)) | Parcial: o diário já mostra a frase do gosto, os números e os gráficos (RF23), e o avatar abre o menu da pessoa. Falta o perfil que outras pessoas veem, ao clicar no nome na Comunidade | RFF10 | M | 3 | RFF08 |
| <a id="rff12"></a>RFF12 | Registrar o mesmo título mais de uma vez, preservando notas, datas e resenhas anteriores | Não implementado. **Substitui a RN05:** hoje rever um filme apaga o registro anterior | RNFF01 | M | 3 | RFF03 |
| <a id="rff13"></a>RFF13 | Buscar e adicionar qualquer título, sem depender do admin | Parcial: o admin já busca e importa do TMDB; falta a própria pessoa poder fazer isso, com limite de uso | — | P | 3 | RFF04 |
| <a id="rff14"></a>RFF14 | Recuperar a senha e verificar o e-mail | Não implementado. Pede decidir sobre os e-mails fictícios aceitos hoje e o custo de envio | RNFF01 | M | 3 | RFF06 |
| <a id="rff15"></a>RFF15 | Ver a compatibilidade de gosto com outra pessoa ("vocês combinam 72%"), com o que têm em comum e onde divergem, e receber sugestões de quem seguir por gosto parecido | Não implementado. Usa o mesmo cálculo de parecidos do recomendador | RFF11 | P a M | 3 | RFF30, RFF41 |
| <a id="rff16"></a>RFF16 | Escolher o modo descoberta em três opções, com o rótulo "Fora da sua bolha" nas sugestões menos óbvias | Não implementado | — | P | 3 | RFF36 |
| <a id="rff17"></a>RFF17 | Ler a página "Como recomendamos", em português simples, com a opção de sair dos experimentos | Não implementado | RNFF08 | P | 3 | parte do RFF38 |
| <a id="rff18"></a>RFF18 | Importar o histórico de outros apps, como Letterboxd e TV Time, a partir do arquivo exportado pela pessoa | Não implementado; **prioridade a definir pela equipe**. Os termos do Letterboxd proíbem coleta automática | RFF12, RFF13, RFF01 | M | 3 | RFF39 |
| <a id="rff19"></a>RFF19 | Ver onde assistir ou ouvir cada título, por país, com link para o serviço: no detalhe, os serviços em três grupos (assinatura, aluguel e compra); no card do feed, os logos dos serviços | Não implementado. Filmes e séries: a rota de provedores do TMDB, guardada junto do título e atualizada toda semana, exige exibir "Dados de disponibilidade: JustWatch"; sem API pública dos serviços, o link abre a página do título no TMDB ou a busca do serviço. Música: os IDs do Spotify e do Deezer vêm das ligações do MusicBrainz e do Wikidata; na falta, a busca pública do Deezer e a do iTunes; o YouTube Music abre pela busca. A API do Spotify fica de fora: em 2026, o modo de desenvolvimento aceita 5 pessoas e exige Premium | RNFF03; RFF01 (música) | M a G | 4 | RFF19 |
| <a id="rff20"></a>RFF20 | Pedir sugestões pelo momento: tom (leve ou intenso), duração máxima e ocasião, com o atalho "Hoje à noite" que junta o momento, os seus serviços e, se quiser, outra pessoa | Não implementado: o TMDB tem a duração; o tom vem do vocabulário de clima. O "Hoje à noite" com outra pessoa vem com o RFF28 | RNFF09 | M | 4 | RFF21, RFF29 |
| <a id="rff21"></a>RFF21 | Marcar os serviços que assina e filtrar o Para você por "só o que eu tenho"; o motivo pode citar o serviço ("está na sua Netflix") | Não implementado | RFF19 | P a M | 4 | RFF27 |
| <a id="rff22"></a>RFF22 | Ordenar o Quero ver pelo que mais combina agora, juntando o gosto, a disponibilidade nos seus serviços e o momento | Não implementado | RFF19, RFF20 | P a M | 4 | RFF31 |
| <a id="rff23"></a>RFF23 | Buscar por clima ("melancólico", "épico", "leve") e receber filmes, séries e álbuns juntos | Não implementado | RNFF09, RFF01 | M | 4 | RFF25 |
| <a id="rff24"></a>RFF24 | Acompanhar séries por temporada e com o estado "assistindo" | Não implementado | RFF12 | M | 4 | RFF05 |
| <a id="rff25"></a>RFF25 | Pedir sugestões em português, com expressões brasileiras ("algo para a Sessão da Tarde"), que viram os filtros do RFF20 | Não implementado. A IA só interpreta o pedido; quem recomenda continua sendo o recomendador. Precisa de orçamento | RFF20, RNFF09 | M | 4 | RFF35 |
| <a id="rff26"></a>RFF26 | Ver no detalhe do título as ligações com outras mídias, nas seções "Para ouvir depois" e "Para ver depois": trilha sonora, compositor, quem atua e também canta, cinebiografias e documentários | Não implementado. Começa por compositor e trilha, as pontes com cobertura medida (esforço M nessa versão). As pontes entram como ligações do grafo de conteúdo (decisão do EXP01) | RFF01, RNFF03 | G | 5 | RFF22, RFF24 |
| <a id="rff27"></a>RFF27 | Receber no Para você sugestões de outra mídia, como o par filme e álbum, sempre com a ponte no motivo e em lugares fixos | Não implementado | RFF26, RNFF09 | G | 5 | RFF09, RFF23 |
| <a id="rff28"></a>RFF28 | Receber sugestões para assistir ou ouvir junto, combinando o gosto de duas ou mais pessoas | Não implementado | RFF15 | M | 5 | RFF20 |
| <a id="rff29"></a>RFF29 | Receber um aviso no Início quando um título do Quero ver entrar em um dos seus serviços | Não implementado. O aviso de que vai sair fica como extensão: não há fonte gratuita que cubra a Globoplay | RFF21 | M | Depois | RFF28 |
| <a id="rff30"></a>RFF30 | Curtir e comentar resenhas na Comunidade, com moderação dos comentários e o rank de quem escreve, pelas curtidas recebidas | Não implementado: precisa de tabelas novas. Hoje a Comunidade só conta as resenhas | RNFF01 | M | Depois | RFF12, RFF13 |
| <a id="rff31"></a>RFF31 | Ver o próprio histórico de atividades, em ordem de data e com filtro por tipo: registros, notas, resenhas, itens adicionados a listas, curtidas e pessoas seguidas | Não implementado. Quem vê o histórico de outra pessoa segue o RFF10 | RFF09, RFF30, RFF10 | M | Depois | RFF16 |
| <a id="rff32"></a>RFF32 | Ver o tema do mês: uma prateleira curada e um desafio com selo, como "Feito em Alagoas" | Não implementado. Usa as listas que já existem | — | P a M | Depois | RFF40, RFF42 |

## Rastreabilidade

Os caminhos de código são relativos a `backend/app/`, e os de teste, a `backend/tests/`.

| ID | Origem | EAP | Código | Testes |
|---|---|---|---|---|
| RF01 | DCU: Cadastrar Conta | 2.1, 3.2 | `routers/auth.py` | `test_auth.py` |
| RF02 | DCU: Fazer Login | 2.1, 3.2 | `routers/auth.py`, `auth.py` | `test_auth.py` |
| RF03 | DCU: Definir Preferências Iniciais | 2.1 | `routers/auth.py` | `test_recommendations.py` |
| RF04 | DCU: Buscar Mídias | 2.3 | `routers/media.py` | `test_diary_lists.py` |
| RF05 | PLANO §8 | 2.3 | `routers/media.py` | `test_diary_lists.py` |
| RF06 | DCU: Registrar Consumo | 2.2 | `routers/diary.py`, `crud.py` | `test_diary_lists.py` |
| RF07 | DCU: Avaliar Mídia | 2.2 | `routers/diary.py` | `test_diary_lists.py` |
| RF08 | DCU: Gerenciar Listas | 2.2 | `routers/lists.py` | `test_diary_lists.py` |
| RF09 | DCU: Ver Recomendações | 2.3 | `routers/recommendations.py` | `test_recommendations.py` |
| RF10 | DCU: Descartar Recomendação; DA | 2.3 | `routers/recommendations.py` | `test_recommendations.py` |
| RF11 | DCU: Gerar Recomendações | 3.4 | `services/recommender.py` | `test_recommendations.py` |
| RF12 | DA: cold start | 3.4 | `services/recommender.py` | `test_recommendations.py` |
| RF13 | PLANO §6 | 3.4 | `services/recommender.py` | `test_recommendations.py` (só verifica que o motivo existe) |
| RF14 | DCU: Gerenciar Catálogo | 2.4 | `routers/admin.py` | `test_admin.py` |
| RF15a | DCU: Sincronizar Catálogo Externo | 3.3 | `services/catalog.py` | `test_admin.py` |
| RF15b | DCU: Sincronizar Catálogo Externo | 3.3 | `services/tmdb.py` | `test_tmdb_unit.py`, `integration/` |
| RF16 | DCU: Moderar Avaliações | 2.4 | `routers/admin.py` | `test_admin.py` |
| RF17 | Pitch; PLANO §2 | 4.2 | `services/metrics.py` | `test_admin.py` |
| RF18 | EAP 2.0 | 2.1 a 2.4 | `frontend/` | Sem testes automatizados; fluxo testado no navegador |
| RF19 | Pedido da GP, 06/11 | 2.2 | `frontend/src/pages/DiaryPage.tsx` | Sem testes automatizados; fluxo testado no navegador |
| RF20 | Pedido da GP, 06/11 | 2.3 | `routers/community.py`, `frontend/src/pages/CommunityPage.tsx` | `test_community.py` |
| RF21 | Pedido da GP, 06/11 | 2.3 | `routers/media.py`, `services/recommender.py` | `test_recommendations.py` |
| RF22 | Pedido da GP, 06/11 | 2.3 | `routers/media.py`, `frontend/src/pages/SearchPage.tsx` | `test_diary_lists.py` |
| RF23 | Pedido da GP, 08/11; parte do RFF11 | 2.2 | `frontend/src/taste.ts`, `frontend/src/components/TasteCharts.tsx` | Sem testes automatizados; fluxo testado no navegador |
| RF24 | Pedido da GP, 08/11 | 2.3 | `frontend/src/pages/HomePage.tsx` | Sem testes automatizados; fluxo testado no navegador |
| RF25 | Pedido da GP, 08/11 | 2.1 | `frontend/src/pages/LandingPage.tsx` | Sem testes automatizados; fluxo testado no navegador |
| RF26 | Pedido da GP, 08/11 | 2.4 | `routers/admin.py`, `frontend/src/pages/AdminPage.tsx` | `test_admin.py` |
