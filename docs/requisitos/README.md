# Requisitos do Tastory

> **Versão 6, 06/11/2026.** Base: pitch (DCU, DA e EAP), [`PLANO.md`](../PLANO.md), issues do GitHub e o código atual.
> Quando estes documentos divergirem do `PLANO.md`, valem estes documentos.

O que será entregue em 10/11 está em [MVP.md](../MVP.md), e os responsáveis e critérios de aceite por pacote da
EAP estão em [ENTREGAS.md](../ENTREGAS.md). Os requisitos do sistema final, com música, estão em
[ARQUITETURA.md](../ARQUITETURA.md#requisitos-do-sistema-final).

O pitch é a linha de base original. Estes requisitos foram consolidados em 05/11/2026 a partir dele e do produto
já construído, por isso cada um registra a situação atual.

## Categorias

| Arquivo | Conteúdo |
|---|---|
| [funcionais.md](funcionais.md) | 20 requisitos funcionais, por pacote do DCU, com rastreabilidade |
| [regras-de-negocio.md](regras-de-negocio.md) | 26 regras de negócio, com rastreabilidade |
| [nao-funcionais.md](nao-funcionais.md) | 21 requisitos não funcionais, gerais e de deploy, com a forma de verificar |

## Legendas

**Situação**

- **Atende:** implementado e coberto por teste automatizado, salvo nota em contrário.
- **Parcial:** implementado, mas depende de uma regra que hoje não é cumprida.
- **Não atende:** o comportamento atual contraria a regra.

**MVP**

- **Deve:** obrigatório em 10/11.
- **Deveria:** entra se houver tempo.
