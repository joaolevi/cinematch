# Requisitos do Tastory

> **Versão 7, 10/11/2026.** Base: pitch (DCU, DA e EAP), [`PLANO.md`](../gestao/PLANO.md), issues do GitHub e o código atual.
> Quando estes documentos divergirem do `PLANO.md`, valem estes documentos.

O MVP, entregue em 10/11/2026, está em [MVP.md](../gestao/MVP.md), e os responsáveis e critérios de aceite por pacote
da EAP estão em [ENTREGAS.md](../gestao/ENTREGAS.md). Cada arquivo abaixo traz os requisitos do MVP e, na seção
"Futuros", os do sistema final, com música. A visão geral dos futuros por incremento está em
[incrementos.md](incrementos.md).

O pitch é a linha de base original. Estes requisitos foram consolidados em 05/11/2026 a partir dele e do produto
já construído, por isso cada um registra a situação atual.

## Categorias

| Arquivo | Conteúdo |
|---|---|
| [funcionais.md](funcionais.md) | 27 requisitos funcionais do MVP (RF01 a RF26), por pacote do DCU, com rastreabilidade, e 32 futuros (RFF01 a RFF32) |
| [nao-funcionais.md](nao-funcionais.md) | 21 requisitos não funcionais do MVP, gerais e de deploy, com a forma de verificar, e 12 futuros (RNFF01 a RNFF12) |
| [regras-de-negocio.md](regras-de-negocio.md) | 26 regras de negócio, com rastreabilidade |
| [incrementos.md](incrementos.md) | O plano: os requisitos futuros e os experimentos por incremento, com situação, esforço e notas |

## Legendas

**Situação**

- **Atende:** implementado e coberto por teste automatizado, salvo nota em contrário.
- **Parcial:** implementado, mas depende de uma regra que hoje não é cumprida.
- **Não atende:** o comportamento atual contraria a regra.

**MVP**

- **Deve:** obrigatório em 10/11.
- **Deveria:** entra se houver tempo.
