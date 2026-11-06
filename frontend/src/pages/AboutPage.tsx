/** Sobre: apresenta o projeto e traz o crédito exigido pelo TMDB. */
export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Sobre o Tastory</h1>
        <p className="mt-2 text-muted">
          O Tastory é o diário da história do seu gosto: você registra o que assiste, e ele aprende com isso para
          sugerir o que ver depois.
        </p>
      </div>

      <section>
        <h2 className="text-xl font-semibold">Créditos</h2>
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="mt-3 inline-block">
          <img src="/tmdb-logo.svg" alt="TMDB" className="h-4" />
        </a>
        <p className="mt-3 text-sm text-muted">Os dados e as imagens dos títulos vêm do TMDB.</p>
        <p className="mt-1 text-sm text-muted">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">O projeto</h2>
        <p className="mt-2 text-sm text-muted">
          Criado pela Equipe Gamma na disciplina de Gerência de Projeto 2026.2 da UFAL.
        </p>
      </section>
    </div>
  );
}
