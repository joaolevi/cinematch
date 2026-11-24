import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm text-stone-700">{children}</div>
    </section>
  );
}

/** Como recomendamos (RFF17): o recomendador explicado em português simples. */
export default function HowPage() {
  usePageTitle("Como recomendamos");
  const { user } = useAuth();
  return (
    <div className="paper relative mx-auto max-w-2xl -rotate-[0.3deg] space-y-8 rounded-sm py-8 pr-8 pl-16">
      <span aria-hidden className="tape -top-2.5 left-14 -rotate-6" style={{ background: TAPE_COLORS[1] }} />
      <div>
        <p className="font-hand text-2xl font-bold text-[#b9452f]">Querido diário,</p>
        <h1 className="text-3xl font-bold">Como o Tastory escolhe o que sugerir</h1>
        <p className="mt-2 text-stone-700">
          Cada sugestão vem com um motivo, e esta página conta de onde ele sai. Nada aqui é mágica: são regras que dá para
          explicar.
        </p>
      </div>

      <Part title="1. O que você conta para a gente">
        <p>
          Tudo começa no que você registra. Um "Já vi" ou "Já ouvi" com nota alta pesa mais; sem nota, conta como um gosto
          moderado. "Quero ver" e as suas listas contam um pouco. "Não me interesso" conta contra. O questionário do começo
          também entra, com peso menor.
        </p>
      </Part>

      <Part title="2. Filmes e séries">
        <p>As sugestões juntam duas coisas:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Parecido com o que você curtiu:</strong> gêneros, palavras-chave, direção e década. É o "Porque você
            curtiu Matrix".
          </li>
          <li>
            <strong>Quem curte o mesmo que você:</strong> o que pessoas com gosto parecido também curtiram, inclusive nas
            avaliações públicas do MovieLens. É o "Quem curtiu Interestelar também curtiu".
          </li>
        </ul>
        <p>
          Os títulos mais conhecidos ganham um pequeno empurrão, e o feed evita repetir o mesmo gênero em sequência. O que
          você já registrou, guardou ou descartou não volta.
        </p>
      </Part>

      <Part title="3. A música entra pelas pontes">
        <p>Os álbuns aparecem quando têm uma ligação com algo que você curtiu:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Trilha sonora:</strong> "Trilha de Interestelar, que você curtiu".
          </li>
          <li>
            <strong>Compositor:</strong> outros discos de quem fez a trilha, como Hans Zimmer.
          </li>
          <li>
            <strong>Mesma pessoa:</strong> quem atua e também canta, como Seu Jorge, de Cidade de Deus.
          </li>
          <li>
            <strong>Gênero, década e país juntos:</strong> sozinhos não bastam; só valem pelo menos dois ao mesmo tempo.
          </li>
        </ul>
        <p>No detalhe de cada título, as mesmas pontes aparecem em "Para ouvir depois" e "Para ver depois".</p>
      </Part>

      <Part title="4. Você escolhe o quanto sair do óbvio">
        <p>
          No <Link to="/para-voce" className="underline hover:text-[#b9452f]">Para você</Link>, "Um pouco além" e "Fora da
          sua bolha" tiram peso do que é muito conhecido e dos gêneros que você mais consome. O motivo avisa quando a
          sugestão veio desse jeito.
        </p>
      </Part>

      <Part title="5. Gosto em comum">
        <p>
          No perfil de outra pessoa, "Vocês combinam X%" compara os gostos de vocês: os títulos que as duas curtiram pesam
          mais, e os gêneros, as pessoas e as décadas em comum pesam menos. "Para ver ou ouvir junto" sugere o que agrada
          às duas, sem nada que alguém já tenha visto.
        </p>
      </Part>

      <Part title="6. Um experimento em andamento">
        <p>
          Para saber se o "quem curte o mesmo que você" ajuda de verdade, metade das contas recebe as sugestões de filmes e
          séries só pela parte do "parecido com o que você curtiu". Medimos quantas sugestões viram "Quero ver" ou "Já vi"
          em cada metade.
          {user && (
            <>
              {" "}
              Sua conta está no grupo <strong>{user.ab_group}</strong>
              {user.ab_group === "A" ? ", que recebe as duas partes." : ", que recebe só a parte do parecido."}
            </>
          )}
        </p>
      </Part>

      <Part title="7. De onde vêm os dados">
        <p>
          Filmes e séries: TMDB, com onde assistir pela JustWatch. Álbuns: MusicBrainz, com capas do Cover Art Archive e
          popularidade do ListenBrainz. Avaliações públicas de filmes: MovieLens. O que você registra fica só no Tastory e
          serve para as suas sugestões, para a Comunidade e para a compatibilidade.{" "}
          <Link to="/sobre" className="underline hover:text-[#b9452f]">Ver os créditos</Link>.
        </p>
      </Part>
    </div>
  );
}
