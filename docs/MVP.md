# Escopo do MVP

> **Versão 6, 06/11/2026.** Entrega: **terça-feira, 10/11/2026**, com deploy como meta. Gerente de projeto: Sophia.
> Documentos ligados: [requisitos](requisitos/README.md), [equipe e entregas](ENTREGAS.md), [guia de deploy](DEPLOY.md) e [arquitetura e sistema final](ARQUITETURA.md).

## Situação atual

A API cobre os 13 casos de uso do pitch para filmes e séries. Os 52 testes offline e os 13 com o TMDB real
passam, e o fluxo completo foi testado no navegador, em Docker com PostgreSQL. As correções e a retirada das
credenciais estão prontas, mas aguardam merge. Falta criar a branch `homol`, publicar o sistema, confirmar a
interface que será entregue, fazer a homologação e preparar a demonstração.

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
- Catálogo ampliado com o TMDB (RF15b), para os colegas encontrarem os títulos na homologação.
- Deploy da API e da interface (RNF11 a RNF19), com a execução local como plano B ([guia](DEPLOY.md)).
- Homologação com 5 a 10 colegas ([#14](https://github.com/joaolevi/cinematch/issues/14)).
- Interface definida (decisão [D2](#decisões)) e demonstração ensaiada.

## Se houver tempo

- Busca que ignora acentos (RN16).
- Teste do MovieLens como fonte do colaborativo, desligado por padrão e com corte em 08/11 ([arquitetura](ARQUITETURA.md)).

## Fora do MVP

- Álbuns ([#19](https://github.com/joaolevi/cinematch/issues/19)).
- Página de perfil ([#16](https://github.com/joaolevi/cinematch/issues/16)) e filtro por década ([#17](https://github.com/joaolevi/cinematch/issues/17)).
- Testes do frontend ([#18](https://github.com/joaolevi/cinematch/issues/18)).
- Recursos sociais, recuperação de senha e auditoria de acessibilidade.
- Os demais [requisitos do sistema final](ARQUITETURA.md#requisitos-do-sistema-final).

## Premissas e restrições

As premissas ainda precisam ser confirmadas pela gerência.

### Premissas

- A equipe tem disponibilidade de 06/11 a 09/11, incluindo o fim de semana.
- O projeto não tem orçamento, então usa apenas serviços gratuitos.
- Alguém da equipe tem uma chave do TMDB, ou uma gratuita será criada.
- O front oficial consome a API pelo contrato em [`API.md`](API.md).

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
- [ ] Testes offline verdes e CI verde.
- [ ] Sistema publicado em URL com HTTPS e sem credencial pública, ou decisão registrada de apresentar localmente.
- [ ] Homologação feita com 5 a 10 colegas, com o resultado registrado na issue [#14](https://github.com/joaolevi/cinematch/issues/14).
- [ ] Demo ensaiada do início ao fim, com plano B em vídeo ou prints.

## Cronograma

### Sex 06/11

- **Sophia:** correções RN02, RN12, RN13 e RN14, com testes; senhas fora do código (RNF12).
- **Vinicius:** escolher a hospedagem; incluir o driver PostgreSQL; fixar as versões das dependências (RNF18).
- **Antonio:** testes das rotas descobertas.
- **Lara:** informar o estado do front oficial.
- **Levi:** criar a branch `homol` no GitHub.

### Sáb 07/11

- **Vinicius:** publicar a API com PostgreSQL e fazer a carga inicial, com o catálogo ampliado.
- **Lara:** apontar o front para a API publicada.
- **Antonio:** rodar os testes de integração com o TMDB real.
- **Levi:** atualizar `PLANO.md` e `CLAUDE.md`; revisar os critérios de aceite com a equipe.
- **Sophia:** limitar o tamanho dos campos (RNF16); ajustar as consultas do diário e das listas (RNF17); confirmar RNF09, RNF10, as premissas e o Sponsor.

### Dom 08/11

- **Sophia:** decidir a interface da entrega (D2).
- **Vinicius:** publicar a interface e configurar o CORS.
- **Antonio:** testar `dev.sh` e `demo.sh`; preparar o plano B local e testar de ponta a ponta.
- **Bárbara:** preparar a explicação do resultado do A/B; se houver tempo, testar o MovieLens.

### Seg 09/11

Nesta ordem:

1. **Vinicius e Antonio:** testar o fluxo completo na URL pública.
2. **Lara:** fazer os ajustes finais no front.
3. **Antonio:** conduzir a homologação com os colegas ([#14](https://github.com/joaolevi/cinematch/issues/14)).
4. **Bárbara:** analisar a taxa de aceitação da homologação.
5. **Levi:** conduzir o ensaio e preparar o plano B em vídeo ou prints ([#15](https://github.com/joaolevi/cinematch/issues/15)).
6. **Sophia:** decidir entre deploy e execução local.
7. **Levi:** com a aprovação do Antonio, subir a `homol` para a `main`.

### Ter 10/11

- **Vinicius:** acessar a URL antes da apresentação.
- **Equipe:** entrega.

## Decisões

### Pendentes

| ID | Decisão | Proposta | Quem decide | Prazo |
|---|---|---|---|---|
| D2 | Qual interface será entregue? | Front oficial, se cobrir o fluxo principal contra a API até 08/11; senão, `demo-front` como está | Sophia, com Lara | 08/11 |
| D6 | Quem é o Sponsor do pitch? | Registrar quem representa esse papel na disciplina | Sophia | 07/11 |

### Aprovadas

| ID | Decisão | Quem aprovou | Data |
|---|---|---|---|
| | Regras RN12, RN13 e RN14 | Sophia (GP) | 05/11 |
| D1 | Sem meta numérica para a taxa de aceitação no MVP. A entrega exige medir corretamente (RN12), e "o híbrido aceita mais que o conteúdo" fica como hipótese a avaliar depois do projeto, com usuários reais | Sophia (GP) | 05/11 |
| D3 | Demonstração com deploy como meta e execução local como plano B | Sophia (GP) | 05/11 |
| D4 | A homologação com colegas é obrigatória no MVP | Sophia (GP) | 06/11 |
| D5 | Cargos da equipe, em [ENTREGAS.md](ENTREGAS.md#equipe) | Equipe | 06/11 |
| D7 | Filmes e séries são recomendados juntos; música, separadamente ([arquitetura](ARQUITETURA.md#decisões)) | Sophia (GP) | 06/11 |
| D8 | O MVP mantém o cálculo atual do recomendador | Sophia (GP) | 06/11 |
| D9 | O nome do produto é Tastory, inclusive no código | Sophia (GP) | 06/11 |
| D11 | O sistema roda em Docker, com API, interface e PostgreSQL (RNF19) | Sophia (GP) | 06/11 |
| D10 | As tarefas entram na branch `homol`, o QA testa ali, e a `main` só recebe a versão aprovada ([CONTRIBUTING](../CONTRIBUTING.md#branches-e-versões)) | Sophia (GP) | 06/11 |

## Controle de mudanças

| Data | Mudança | Motivo | Aprovação |
|---|---|---|---|
| 05/11 | Integração real com o TMDB entra, com o mock como alternativa offline | Pôsteres e dados oficiais | PLANO §13 |
| 05/11 | O front oficial sai deste repositório | Ficou com outra pessoa da equipe | PLANO §13 |
| 05/11 | O deploy, excluído no PLANO, volta como meta do MVP | Está previsto no pitch e tem responsável | Sophia (GP) |
| 05/11 | A taxa de aceitação fica sem meta numérica | Ainda não há dados reais para definir um valor | Sophia (GP) |
| 06/11 | A homologação passa de opcional a obrigatória | Consta no Estágio 3 do pitch, e o deploy a torna viável | Sophia (GP) |
| 06/11 | A gerência passa a constar com Sophia; o PLANO cita João Levi | Cargos definidos pela equipe | Equipe |
| 06/11 | Entram no MVP três ajustes para o sistema publicado (RNF16 a RNF18) | Revisão com foco no sistema final | Sophia (GP) |
| 06/11 | O sistema passa a se chamar Tastory em vez de CineMatch | Unificar o nome do pitch, do Trello e do código | Sophia (GP) |
| 06/11 | O TMDB real (RF15b) passa de opcional a obrigatório, com catálogo ampliado | Na homologação, a pessoa só encontra títulos que estão no catálogo | Sophia (GP) |

## Riscos

| Risco | Efeito | Resposta | Responsável |
|---|---|---|---|
| O front oficial não ficar pronto | Sem interface oficial na entrega | Usar o `demo-front`, que compila, mas ainda precisa de teste no navegador | Lara |
| O painel do A/B não favorece o híbrido | Na simulação, A tem 65,0% e B tem 66,7%, mas ela não serve para essa comparação. Com dados reais do MovieLens, A supera B | Apresentar o painel como simulação do mecanismo de medição e usar o teste com o MovieLens como evidência exploratória | Bárbara |
| Publicar com as credenciais do repositório | Qualquer pessoa entra como administrador | Tratar o RNF12 como condição para publicar | Sophia |
| O deploy não ficar estável a tempo | Sem URL pública na entrega | Decidir em 09/11 e, se preciso, apresentar localmente | Vinicius |
| Serviço gratuito dormindo | O primeiro acesso pode demorar cerca de um minuto | Acessar a URL antes da apresentação | Vinicius |
| Homologação com poucas pessoas | Com 5 a 10 colegas, a taxa não permite conclusão | Tratar o resultado como ilustrativo. Sem deploy, fazer a sessão em uma só máquina, porque as métricas ficam em um único banco | Antonio |
| Sem internet na demo | Títulos sem pôster real | Usar o catálogo mock, que funciona offline, e testar esse cenário antes | Antonio |
| Título procurado fora do catálogo | Mesmo com 504 títulos, "O Agente Secreto" não aparece na busca | Importar pelo painel de admin os títulos pedidos antes da sessão | Antonio |
