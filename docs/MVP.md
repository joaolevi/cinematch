# Escopo do MVP

> **Versão 18, 06/11/2026.** Entrega: **terça-feira, 10/11/2026**, com deploy como meta. Gerente de projeto: Sophia.
> Documentos ligados: [requisitos](requisitos/README.md), [equipe e entregas](ENTREGAS.md), [guia de deploy](DEPLOY.md), [teste interno](HOMOLOGACAO.md) e [arquitetura e sistema final](ARQUITETURA.md).

## Situação atual

A API cobre os 13 casos de uso do pitch para filmes e séries. Os 85 testes offline e os 13 com o TMDB real
passam, e o fluxo completo foi testado no navegador, em Docker com PostgreSQL. As correções e a retirada das
credenciais estão na branch `homol`, com o CI passando. Falta o QA testar a `homol`, publicar o sistema, ajustar o
design, fazer o teste interno e preparar a demonstração.

## Objetivo

Em 10/11, demonstrar o ciclo completo no sistema publicado, ou localmente como plano B. Uma pessoa se
cadastra, recebe sugestões, reage a elas e vê o feed mudar, enquanto o admin mantém o catálogo, modera
resenhas e acompanha a taxa de aceitação.

**Critério de sucesso do MVP:** todos os requisitos **Deve** atendidos e a taxa de aceitação medida
corretamente. O benefício do recomendador será avaliado depois, com dados reais (decisão D1).

## Dentro do MVP

- Todos os requisitos marcados como **Deve** em [funcionais.md](requisitos/funcionais.md), para filmes e séries.
- Quatro correções na API, com teste: RN02, RN12, RN13 e RN14 ([regras de negócio](requisitos/regras-de-negocio.md)).
- Testes para as quatro rotas descobertas (RNF06).
- Três ajustes para o sistema publicado: tamanho dos campos (RNF16), consultas do diário e das listas (RNF17) e versões fixas das dependências (RNF18).
- Catálogo ampliado com o TMDB (RF15b), para a equipe encontrar os títulos no teste interno.
- Recomendações de filmes com o MovieLens 32M, ligadas depois da validação da Bárbara ([arquitetura](ARQUITETURA.md)).
- Deploy da API e da interface (RNF11 a RNF19), com a execução local como plano B ([guia](DEPLOY.md)).
- Teste interno com as 6 pessoas da equipe, no sistema publicado ([#14](https://github.com/joaolevi/cinematch/issues/14)).
- Interface em `frontend/`, com o design revisado pela Lara, e demonstração ensaiada.
- Busca que ignora acentos (RN16), que estava em "se houver tempo" e já foi feita.

## Fora do MVP

- Homologação com pessoas de fora da equipe.
- Álbuns ([#19](https://github.com/joaolevi/cinematch/issues/19)).
- Página de perfil ([#16](https://github.com/joaolevi/cinematch/issues/16)) e filtro por década ([#17](https://github.com/joaolevi/cinematch/issues/17)).
- Testes do frontend ([#18](https://github.com/joaolevi/cinematch/issues/18)).
- Recursos sociais, recuperação de senha e auditoria de acessibilidade.
- Os demais [requisitos do sistema final](ARQUITETURA.md#requisitos-do-sistema-final).

## Premissas e restrições

As premissas foram confirmadas por Sophia (GP) em 06/11/2026.

### Premissas

- A equipe tem disponibilidade de 06/11 a 09/11, incluindo o fim de semana.
- O projeto não tem orçamento: a publicação usa o servidor do Vinicius, sem custo.

### Restrições

- A entrega é em 10/11/2026.
- O repositório é público, então nenhum segredo pode ir para o git.
- Este incremento cobre filmes e séries; álbuns ficam para o incremento 2, como previsto no pitch.
- O uso do TMDB exige exibir o crédito na interface.

## Critérios de pronto

Os critérios de cada pacote da EAP estão em [ENTREGAS.md](ENTREGAS.md#critérios-de-aceite-por-pacote).

- [ ] Usuário novo se cadastra e vê um feed não vazio.
- [ ] Depois de marcar de 3 a 5 títulos no onboarding, o feed muda e explica as sugestões.
- [ ] Quero ver, Já vi e Não me interesso funcionam, e o título não volta ao feed.
- [ ] A busca encontra filmes e séries, e listas podem ser criadas e editadas.
- [ ] Admin sincroniza o mock, edita e remove títulos e oculta resenhas; resenha oculta e editada continua oculta.
- [ ] O painel mostra a taxa total e por grupo, sempre entre 0% e 100%.
- [ ] Depois de clonar, um único comando (`./dev.sh`) sobe a API, sem chave de API.
- [x] Testes offline verdes e CI verde.
- [ ] Sistema publicado em URL com HTTPS e sem credencial pública, ou decisão registrada de apresentar localmente.
- [ ] Teste interno feito com a equipe, com o resultado registrado na issue [#14](https://github.com/joaolevi/cinematch/issues/14).
- [ ] Demo ensaiada do início ao fim, com plano B em vídeo ou prints.

## Cronograma

### Sex 06/11

- **Sophia:** correções RN02, RN12, RN13 e RN14, com testes; senhas fora do código (RNF12).
- **Vinicius:** preparar o servidor; fixar as versões das dependências (RNF18).
- **Antonio:** testes das rotas descobertas.
- **Lara:** revisar o `frontend/` e começar os ajustes de design.
- **Levi:** criar a branch `homol` no GitHub.

### Sáb 07/11

- **Vinicius:** publicar a API com PostgreSQL e fazer a carga inicial, com o catálogo ampliado.
- **Lara:** apontar o front para a API publicada.
- **Antonio:** rodar os testes de integração com o TMDB real.
- **Levi:** atualizar `PLANO.md` e `CLAUDE.md`; revisar os critérios de aceite com a equipe.
- **Sophia:** revisar os PRs.

### Dom 08/11

- **Vinicius:** publicar a interface e configurar o CORS.
- **Antonio:** testar `dev.sh` e `demo.sh`; preparar o plano B local e testar de ponta a ponta.
- **Bárbara:** preparar a explicação do resultado do A/B; validar as recomendações com o MovieLens.

### Seg 09/11

Nesta ordem:

1. **Vinicius e Antonio:** testar o fluxo completo na URL pública.
2. **Lara:** fazer os ajustes finais no front.
3. **Antonio:** conduzir o teste interno com a equipe ([#14](https://github.com/joaolevi/cinematch/issues/14)).
4. **Bárbara:** analisar a taxa de aceitação do teste interno.
5. **Levi:** conduzir o ensaio e preparar o plano B em vídeo ou prints ([#15](https://github.com/joaolevi/cinematch/issues/15)).
6. **Sophia:** decidir entre deploy e execução local.
7. **Levi:** com a aprovação do Antonio, subir a `homol` para a `main`.

### Ter 10/11

- **Vinicius:** acessar a URL antes da apresentação.
- **Equipe:** entrega.

## Decisões

Nenhuma decisão pendente em 06/11/2026.

### Aprovadas

| ID | Decisão | Quem aprovou | Data |
|---|---|---|---|
| | Regras RN12, RN13 e RN14 | Sophia (GP) | 05/11 |
| D1 | Sem meta numérica para a taxa de aceitação no MVP. A entrega exige medir corretamente (RN12), e "o híbrido aceita mais que o conteúdo" fica como hipótese a avaliar depois do projeto, com usuários reais | Sophia (GP) | 05/11 |
| D2 | A interface entregue é o `frontend/`, criado a partir do protótipo de apresentação | Sophia (GP) | 06/11 |
| D3 | Demonstração com deploy como meta e execução local como plano B | Sophia (GP) | 05/11 |
| D4 | A homologação do MVP é um teste interno com a equipe. A homologação com pessoas de fora fica para depois da entrega | Sophia (GP) | 06/11 |
| D5 | Cargos da equipe, em [ENTREGAS.md](ENTREGAS.md#equipe) | Equipe | 06/11 |
| D6 | O Sponsor do pitch é o Professor Rafael, professor da disciplina | Sophia (GP) | 06/11 |
| D7 | Filmes e séries são recomendados juntos; música, separadamente ([arquitetura](ARQUITETURA.md#decisões)) | Sophia (GP) | 06/11 |
| D8 | O MVP mantém o cálculo atual do recomendador. A única exceção é a tabela de vizinhos do MovieLens (D14), já pronta | Sophia (GP) | 06/11 |
| D9 | O nome do produto é Tastory, inclusive no código | Sophia (GP) | 06/11 |
| D11 | O sistema roda em Docker, com API, interface e PostgreSQL (RNF19) | Sophia (GP) | 06/11 |
| D12 | O sistema será publicado no servidor do Vinicius, sem custo | Sophia (GP) | 06/11 |
| D14 | Os vizinhos do MovieLens 32M substituem os usuários inventados nos filmes, com a opção desligada por padrão | Sophia (GP) | 06/11 |
| D15 | O teste A/B continua no sistema, mas no MVP mostra que a medição funciona. A evidência de qualidade vem do teste com o MovieLens, e o teste interno é ilustrativo | Sophia (GP) | 06/11 |
| D13 | O onboarding pergunta gêneros, épocas, diretores e títulos, em três passos. Palavras-chave ficam de fora, porque são termos crus e muitos em inglês | Sophia (GP) | 06/11 |
| D10 | As tarefas entram na branch `homol`, o QA testa ali, e a `main` só recebe a versão aprovada ([CONTRIBUTING](../CONTRIBUTING.md#branches-e-versões)) | Sophia (GP) | 06/11 |

## Controle de mudanças

| Data | Mudança | Motivo | Aprovação |
|---|---|---|---|
| 05/11 | Integração real com o TMDB entra, com o mock como alternativa offline | Pôsteres e dados oficiais | PLANO §13 |
| 05/11 | O front oficial sai deste repositório | Ficou com outra pessoa da equipe | PLANO §13 |
| 06/11 | A interface volta para este repositório, em `frontend/`, a partir do protótipo | Reduz o risco da entrega, e a Lara passa a focar no design | Sophia (GP) |
| 05/11 | O deploy, excluído no PLANO, volta como meta do MVP | Está previsto no pitch e tem responsável | Sophia (GP) |
| 05/11 | A taxa de aceitação fica sem meta numérica | Ainda não há dados reais para definir um valor | Sophia (GP) |
| 06/11 | A publicação será no servidor do Vinicius, e não em hospedagem gratuita | Evita custo e as limitações de planos gratuitos | Sophia (GP) |
| 06/11 | O MovieLens passa de "se houver tempo" a parte do MVP | Foi a maior melhora medida nas recomendações | Sophia (GP) |
| 06/11 | O onboarding passa a coletar épocas e diretores, em três passos | Aproveitar melhor o que o recomendador já usa | Sophia (GP) |
| 06/11 | A homologação passa de opcional a obrigatória | Consta no Estágio 3 do pitch, e o deploy a torna viável | Sophia (GP) |
| 06/11 | A gerência passa a constar com Sophia; o PLANO cita João Levi | Cargos definidos pela equipe | Equipe |
| 06/11 | Entram no MVP três ajustes para o sistema publicado (RNF16 a RNF18) | Revisão com foco no sistema final | Sophia (GP) |
| 06/11 | O sistema passa a se chamar Tastory em vez de CineMatch | Unificar o nome do pitch, do Trello e do código | Sophia (GP) |
| 06/11 | O TMDB real (RF15b) passa de opcional a obrigatório, com catálogo ampliado | Na homologação, a pessoa só encontra títulos que estão no catálogo | Sophia (GP) |
| 06/11 | O detalhe do título ganha "Não me interesso", com opção de desfazer | Na listagem o botão já existia, e faltava no detalhe | Sophia (GP) |
| 06/11 | O detalhe mostra o elenco, e a data do "Já vi" passa a ser opcional, com atalhos para hoje e ontem | Pedido da GP ao testar o sistema: a data preenchida sozinha podia ficar errada | Sophia (GP) |
| 06/11 | Entram no MVP o top 10 do diário (RF19, RN17), novas sugestões ao rolar o feed e a escolha da ordem na busca | Pedido da GP ao testar o sistema. A busca já pedia ordenação no RF04, mas a tela não oferecia | Sophia (GP) |
| 06/11 | Títulos do onboarding ficam sem nota (RN18), títulos futuros aparecem como "Em breve" (RN19) e o feed permite trocar as sugestões | A nota automática distorcia as médias e o top 10, e o botão ↻ repetia a mesma lista | Sophia (GP) |
| 06/11 | Um título passa a contar como exibido quando aparece na tela, e não quando a API o envia (RN12) | Com o feed ao rolar e a troca de sugestões, títulos que ninguém viu entravam na taxa de aceitação | Sophia (GP) |
| 06/11 | A homologação com 5 a 10 colegas vira um teste interno com as 6 pessoas da equipe, e a homologação com pessoas de fora fica para depois da entrega | Prazo curto, e o resultado já era ilustrativo (D15). Perde-se o olhar de quem não conhece o sistema | Sophia (GP) |

## Riscos

| Risco | Efeito | Resposta | Responsável |
|---|---|---|---|
| O design não ficar pronto a tempo | Interface funcional, mas sem o acabamento planejado | A interface atual já cobre o fluxo completo; priorizar o que aparece na demonstração | Lara |
| Painel do A/B lido como conclusão | Na simulação, A tem 65,0% e B tem 66,7%, mas ela não serve para essa comparação. Com dados reais do MovieLens, A supera B | O painel avisa de onde vêm os números; na apresentação, usar o teste com o MovieLens como evidência exploratória | Bárbara |
| Séries com sugestões fracas | Sem dados reais, as séries dependem só do conteúdo e aparecem títulos obscuros | Avaliação feita ([arquitetura](ARQUITETURA.md#séries-sem-dados-reais)): falta a Bárbara decidir o peso da popularidade nas séries | Bárbara |
| Publicar com as credenciais do repositório | Qualquer pessoa entra como administrador | Tratar o RNF12 como condição para publicar | Sophia |
| Mudança no banco depois da publicação | O projeto não tem migrations: uma coluna nova derruba a busca e o feed até alguém ajustar o banco | Não mudar os modelos até a entrega. Se for inevitável, seguir o [guia](DEPLOY.md#atualizar-o-sistema-publicado) | Sophia |
| O deploy não ficar estável a tempo | Sem URL pública na entrega | Decidir em 09/11 e, se preciso, apresentar localmente | Vinicius |
| Servidor fora do ar | Queda de energia ou de internet na casa do Vinicius derruba o sistema | Conferir a URL antes da apresentação e manter a execução local como plano B | Vinicius |
| Exposição da rede doméstica | Um site público pode abrir um caminho para a rede da casa | Usar túnel com HTTPS e não abrir portas no roteador | Vinicius |
| Teste interno só com quem conhece o sistema | Problemas de uso podem passar despercebidos, e a taxa não permite conclusão | Chamar de teste interno na apresentação e tratar o resultado como ilustrativo. Sem deploy, fazer o teste em uma só máquina, porque as métricas ficam em um único banco | Antonio |
| Sem internet na demo | Títulos sem pôster real | O sistema local mostra um pôster gerado no lugar da imagem ([plano B](DEPLOY.md#plano-b)); testar esse cenário antes | Antonio |
| Título procurado fora do catálogo | Com cerca de 3.950 títulos, a maioria aparece, mas o catálogo ainda não cobre tudo | Importar pelo painel de admin os títulos que faltarem | Antonio |
