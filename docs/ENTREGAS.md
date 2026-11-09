# Equipe e entregas

> **Versão 1, 06/11/2026.** Liga a EAP do pitch aos responsáveis, aos requisitos e aos critérios de aceite.
> O que entra na entrega de 10/11 está em [MVP.md](MVP.md), e os requisitos, em [requisitos/](requisitos/README.md).

## Equipe

| Pessoa | Cargo | Papel no pitch | Áreas no Trello |
|---|---|---|---|
| Sophia | Backend e Gerente de Projeto | Gerente; Equipe de Dev | Backend, Dados, Gestão |
| Levi | Tech Lead e Analista de Requisitos; Trello e apresentação | Analista | Requisitos, Docs |
| Antonio | QA | QA | QA |
| Vinicius | DevOps | Equipe de Dev | DevOps |
| Bárbara | Engenheira de IA | Equipe de Dev | Recomendação |
| Lara | Front e Design | Equipe de Dev | Frontend, Design |

O Sponsor do pitch é o Professor Rafael, professor da disciplina.

## RACI por pacote

Segue a regra do pitch: exatamente um **A** por linha e ao menos um **R**. A gerência é **A** em todos os pacotes.
Na coluna **I**, "Equipe" são as demais pessoas.

| Pacote da EAP | R | A | C | I |
|---|---|---|---|---|
| 1.1 Modelagem UML | Levi | Sophia | Antonio | Equipe, Sponsor |
| 1.2 Protótipos de interface | Lara | Sophia | Levi | Equipe, Sponsor |
| 1.3 Arquitetura e APIs | Levi | Sophia | Vinicius | Equipe, Sponsor |
| 2.1 Módulo de acesso | Lara | Sophia | Levi, Antonio | Equipe, Sponsor |
| 2.2 Módulo de registro | Lara | Sophia | Levi, Antonio | Equipe, Sponsor |
| 2.3 Módulo de descoberta | Lara | Sophia | Levi, Antonio, Bárbara | Equipe, Sponsor |
| 2.4 Painel administrativo | Lara | Sophia | Levi, Antonio | Equipe, Sponsor |
| 3.1 Banco de dados | Sophia | Sophia | Vinicius | Equipe, Sponsor |
| 3.2 APIs REST | Sophia | Sophia | Lara, Antonio | Equipe, Sponsor |
| 3.3 Ingestão de catálogo | Sophia | Sophia | Bárbara, Antonio | Equipe, Sponsor |
| 3.4 Serviço de recomendação | Bárbara | Sophia | Levi, Antonio | Equipe, Sponsor |
| 4.1 Testes de integração e sistema | Antonio | Sophia | Sophia, Bárbara | Equipe |
| 4.2 Teste A/B e homologação | Antonio | Sophia | Bárbara, Sponsor | Equipe |
| 4.3 Deploy e documentação | Vinicius, Levi | Sophia | Antonio, Sponsor | Equipe |

## Critérios de aceite por pacote

Os critérios de 1.1 a 4.1 são os "Critério de conclusão" que a equipe registrou nos cartões da EAP no Trello.
Os cartões de 4.2 e 4.3 foram criados em 06/11, e seus critérios foram aprovados por Sophia (GP) no mesmo dia. A coluna Situação reflete
06/11/2026.

| Pacote | Requisitos | Critério de aceite | Situação |
|---|---|---|---|
| 1.1 | RF01 a RF17 | Diagramas revisados, legíveis e coerentes entre si e com a EAP | Diagramas no pitch; confirmar a revisão |
| 1.2 | RF18 | Protótipo de alta fidelidade navegável cobrindo os principais casos de uso; estados com e sem histórico previstos | Não há Figma: o `frontend/` navegável cumpre o pacote (D20) |
| 1.3 | RNF05 | Arquitetura e contratos documentados e revisados pela equipe antes da implementação | Contratos documentados: as 41 rotas coincidem; confirmar a revisão |
| 2.1 | RF01 a RF03, RF18, RF25, RN18 | Usuário consegue criar conta, entrar e definir preferências; onboarding pode ser pulado sem bloquear a navegação | Fluxo testado no navegador e identidade visual aplicada em 08/11 (guia no `frontend/README.md`); aguardando o QA na `homol` |
| 2.2 | RF06 a RF08, RF18, RF19, RN17 | Registros e listas podem ser criados e consultados; a nota é opcional e interações persistidas aparecem corretamente | Fluxo testado no navegador e identidade visual aplicada em 08/11 (guia no `frontend/README.md`); aguardando o QA na `homol` |
| 2.3 | RF04, RF05, RF09, RF10, RF18, RF20 a RF22, RF24, RN19, RN21 a RN26, RNF20, RNF21 | Usuário encontra títulos, acessa sugestões mesmo em cold start e interage com o feed; sugestões descartadas não reaparecem no feed montado | Fluxo testado no navegador e identidade visual aplicada em 08/11 (guia no `frontend/README.md`); aguardando o QA na `homol` |
| 2.4 | RF14 a RF17, RF18, RF26, RNF08 | Acesso protegido por perfil; administrador consegue executar ações de catálogo e moderação; usuário comum não acessa operações privilegiadas | Fluxo testado no navegador e identidade visual aplicada em 08/11 (guia no `frontend/README.md`); aguardando o QA na `homol` |
| 3.1 | RNF13 | Esquema documentado e criado; integridade referencial e persistência dos principais fluxos validadas | Passou em SQLite e PostgreSQL; está na `homol`, aguardando o QA |
| 3.2 | RF01 a RF10, RN01 a RN06, RN08 a RN10, RN13, RN14, RNF16, RNF17 | Endpoints testados, erros tratados, dados persistidos e rotas administrativas protegidas | Corrigido; está na `homol`, aguardando o QA |
| 3.3 | RF15a, RF15b, RN15 | Catálogo audiovisual pesquisável e sincronizável; catálogo musical validado antes da liberação de álbuns | Funciona com o mock e o TMDB real. A parte musical está fora do MVP |
| 3.4 | RF11 a RF13, RN07 | Serviço retorna recomendações mesmo sem histórico; exclui itens descartados ou já registrados conforme regra do produto; feedback alimenta futuras sugestões | Concluído |
| 4.1 | RNF06, RNF07, RNF09 | Principais casos de uso executados, falhas registradas e corrigidas antes do teste interno | Parcial: 115 testes offline e 13 de integração passam, toda rota tem teste e o CI passou no PR #22; faltam os testes do Antonio na `homol` |
| 4.2 | RF17, RN11, RN12, RNF10, RNF14 | Taxa entre 0% e 100% por grupo; teste interno com a equipe registrado na issue [#14](https://github.com/joaolevi/cinematch/issues/14) | Pendente |
| 4.3 | RNF01 a RNF04, RNF11 a RNF15, RNF18, RNF19 | Fluxo completo funcionando em URL com HTTPS, sem credencial pública, e documentação atualizada | Pendente |
