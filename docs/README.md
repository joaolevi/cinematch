# Documentação do Tastory

> **Versão 1, 10/11/2026.** O MVP foi entregue e apresentado em 10/11/2026. Esta pasta tem três partes: gestão do
> projeto, requisitos e documentação técnica.

## Por onde começar

- **Para entender o projeto:** o [registro do MVP](gestao/MVP.md) e o [plano de incrementos](requisitos/incrementos.md).
- **Para desenvolver:** a [arquitetura](tecnico/ARQUITETURA.md), o [guia da API](tecnico/API.md) e o
  [CONTRIBUTING](../CONTRIBUTING.md).
- **Para publicar ou apresentar:** o [guia de deploy](tecnico/DEPLOY.md), com o plano B.

## Gestão do projeto (`gestao/`)

| Documento | Conteúdo |
|---|---|
| [MVP.md](gestao/MVP.md) | Escopo, resultado da entrega, critérios de pronto, decisões, controle de mudanças e riscos do MVP |
| [ENTREGAS.md](gestao/ENTREGAS.md) | Equipe, RACI e critérios de aceite de cada pacote da EAP, com a situação na entrega |
| [HOMOLOGACAO.md](gestao/HOMOLOGACAO.md) | Roteiro de teste com pessoas, para a beta do incremento 3, e a consulta da análise |
| [PLANO.md](gestao/PLANO.md) | Plano original de 05/11/2026, mantido como histórico |
| [pitch-tastory.pdf](gestao/pitch-tastory.pdf) | Pitch: DCU, DA, EAP, RACI e estágios do PRINCE2 |

## Requisitos (`requisitos/`)

| Documento | Conteúdo |
|---|---|
| [README.md](requisitos/README.md) | Como os requisitos estão organizados e as legendas |
| [funcionais.md](requisitos/funcionais.md) | Funcionais do MVP (RF01 a RF26), com rastreabilidade, e os futuros (RFF01 a RFF32) |
| [nao-funcionais.md](requisitos/nao-funcionais.md) | Não funcionais do MVP (RNF01 a RNF21) e os futuros (RNFF01 a RNFF12) |
| [regras-de-negocio.md](requisitos/regras-de-negocio.md) | Regras de negócio (RN01 a RN26), com rastreabilidade |
| [incrementos.md](requisitos/incrementos.md) | O plano: requisitos futuros e experimentos por incremento, com situação, esforço e notas |

## Documentação técnica (`tecnico/`)

| Documento | Conteúdo |
|---|---|
| [ARQUITETURA.md](tecnico/ARQUITETURA.md) | Decisões técnicas, o modelo de recomendação depois do MVP e as pontes entre mídias |
| [AVALIACAO.md](tecnico/AVALIACAO.md) | Experimentos (EXP01 a EXP04), evidências de carga e de qualidade e fontes de dados avaliadas |
| [DEPLOY.md](tecnico/DEPLOY.md) | Como publicar, carregar o MovieLens, fazer backup e o plano B |
| [API.md](tecnico/API.md) | Guia da API para quem consome |
| [openapi.json](tecnico/openapi.json) | Contrato OpenAPI, gerado pelo `make openapi` |
