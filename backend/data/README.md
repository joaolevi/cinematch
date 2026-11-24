# Dados do Tastory

| Arquivo | O que é | Quem cuida |
|---|---|---|
| `seed_catalog.json` | Catálogo de demonstração carregado no primeiro uso | Equipe |
| `mock_external_catalog.json` | Catálogo externo falso, para sincronizar sem internet | Equipe |
| `albuns_demo.csv` | Lista curada dos álbuns de demonstração, com o ID do MusicBrainz e o motivo de cada um | Levi (curadoria) |
| `albums_catalog.json` | Retrato dos álbuns, gerado por `python -m scripts.import_albums` a partir da lista; o seed lê daqui, sem internet | Gerado |
| `generos_musicais.csv` | Gênero oficial do MusicBrainz → gênero amplo do Tastory, usado na carga dos álbuns (RFF01) | Levi (curadoria) |
| `generos_correspondencia.csv` | Gênero de filme ou série → gênero musical que combina, usado na ponte de gênero (RFF26) | Levi (curadoria) |

## Gêneros musicais

O MusicBrainz tem uma lista oficial de cerca de 2.200 gêneros. Na carga, cada álbum guarda:

- em `genres`, o gênero amplo em português (como "MPB"), para mostrar na tela e filtrar;
- em `tags`, os gêneros finos do MusicBrainz (como "tropicália"), para o grafo achar parecidos mais específicos.

`generos_musicais.csv` liga os dois. A primeira versão saiu de regras por palavra, com os gêneros brasileiros tratados
um a um, e cobre 943 dos 2.222 gêneros. Os que não estão no arquivo ficam só como gênero fino, sem gênero amplo.
"Trilha sonora" não aparece aqui porque, no MusicBrainz, é um tipo de lançamento (Soundtrack), e não um gênero: a carga
marca esses álbuns como "Trilha sonora".

Para ajustar, edite a linha numa planilha e abra um PR. Um gênero pode mudar de grupo ou sair do arquivo.

## Correspondência entre filme e música

Os gêneros de filme e de música usam palavras diferentes, então o grafo não os liga sozinho. Cada linha de
`generos_correspondencia.csv` cria a ponte de gênero entre os dois lados, de peso baixo: pela regra de corte do
[ARQUITETURA.md](../../docs/tecnico/ARQUITETURA.md#recomendação-entre-mídias), ela sozinha não gera uma sugestão. A
coluna `por_que` explica cada par. Os nomes da primeira coluna são os gêneros do catálogo (vindos do TMDB, em
`app/services/tmdb.py`), e os da segunda, os gêneros amplos de `generos_musicais.csv` ou "Trilha sonora".

## Álbuns de demonstração

`albuns_demo.csv` tem 207 álbuns: as trilhas e os compositores dos filmes e séries do catálogo (para as pontes
entre mídias), discos brasileiros, com atenção a Alagoas, e internacionais conhecidos. A coluna `pedido` guarda o que foi
procurado, `confianca`, a nota da busca no MusicBrainz (100 = nome exato), e `revisado` marca os 25 que foram corrigidos à
mão (a busca automática tinha pegado a trilha de uma continuação, uma coletânea ou outro disco com o mesmo nome). Para trocar um álbum, troque o `mbid` (o ID
fica no endereço da página do álbum no MusicBrainz, em `/release-group/...`) e rode de novo:

```bash
cd backend && ../.venv/bin/python -m scripts.import_albums   # uns 10 minutos: o MusicBrainz aceita uma consulta por segundo
```

Os dados do MusicBrainz e do ListenBrainz são CC0. As capas não ficam no repositório: o catálogo guarda só o endereço
delas no Cover Art Archive.
