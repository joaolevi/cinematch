# frontend: interface do Tastory

> Responsável: Lara. A interface consome a API pelo contrato em [`../docs/API.md`](../docs/API.md).

React + Vite + TypeScript + Tailwind. Telas: login, onboarding em três passos, feed "Para você", busca, detalhe,
diário, listas, sobre e admin (métricas A/B, catálogo com sincronização/importação do TMDB, moderação).

## Rodar

Na raiz do repositório:

```bash
./demo.sh --reset   # 1ª vez: recria o banco com mock + populares do TMDB e sobe tudo
./demo.sh           # nas próximas
```

Ou manualmente: suba a API (`./dev.sh`) e, em outro terminal, `cd frontend && npm install && npm run dev`.
Abra http://localhost:5173.

## Roteiro da demo (≈ 5 min)

1. Entre como **demo** (`demo@tastory.dev` / `demo123`). O feed mostra **"Em alta"**: é o *cold start*,
   a tela nunca fica vazia.
2. **Definir preferências**: escolha 1–2 gêneros e marque 3–4 títulos que você curte.
3. Volte ao feed: as sugestões agora são personalizadas e **explicadas** ("Porque você curtiu …").
4. **✓ Já vi** em uma sugestão → dê estrelas e escreva uma resenha → aparece no **Diário**.
   **+ Quero** → vai para **Listas → Quero ver**. **✕** → some do feed e não volta.
5. Saia e entre como **admin** (`admin@tastory.dev` / `admin123`):
   - **Métricas A/B**: taxa de aceitação do grupo A (híbrido) e do B (só conteúdo);
   - **Catálogo → Buscar no TMDB**: procure um filme (ex.: *O Agente Secreto*) e clique **+ Importar**;
   - **Moderação**: oculte a resenha do passo 4.
6. Mostre a documentação da API em http://localhost:8000/docs.

Dica: rode `./demo.sh --reset` antes da call para começar com dados limpos.
