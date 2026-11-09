import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Layout";
import PolaroidCollage from "../components/PolaroidCollage";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";

const RED_INK = "text-[#b9452f]";

const STEPS = [
  {
    title: "Conte o que você curte",
    text: "Gêneros, épocas, diretores e alguns títulos que você já viu. Leva um minuto.",
    color: "#f6d27a",
  },
  {
    title: "Receba sugestões explicadas",
    text: "Cada sugestão diz por que apareceu: “porque você curtiu Cidade de Deus”.",
    color: "#f3a48f",
  },
  {
    title: "Escreva no seu diário",
    text: "Nota, data e resenha. Cada título vira uma polaroide colada no seu diário.",
    color: "#b7d1b9",
  },
  {
    title: "Descubra o seu gosto",
    text: "Uma frase que resume você, o seu top 10, gráficos e o que a galera anda vendo.",
    color: "#b9d0e4",
  },
];

/** Apresentação para quem ainda não tem conta: o que é o Tastory e como funciona. */
export default function LandingPage() {
  usePageTitle("A história do seu gosto");
  return (
    <div className="min-h-screen">
      {/* Em cima, a folha de papel; embaixo, um corte em diagonal para o fundo escuro, como a página dentro do sistema */}
      <div className="desk desk-bar landing-sheet pb-24 sm:pb-32">
        <header className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-10">
          <Logo />
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/login" className="btn-ghost px-4 py-1.5">
              Entrar
            </Link>
            <Link to="/login?modo=cadastro" className="btn-primary px-4 py-1.5">
              Criar conta
            </Link>
          </nav>
        </header>

        <section className="mx-auto grid max-w-[1680px] items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:px-10 lg:py-14">
          <div>
            <p className={`font-hand text-3xl font-bold ${RED_INK}`}>Querido diário,</p>
            <h1 className="mt-2 font-display text-4xl leading-tight font-bold sm:text-5xl xl:text-6xl">
              A história do <mark className="marker">seu gosto</mark>, título por título.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8">
              O Tastory é um diário de filmes e séries que aprende com o que você registra. Você anota o que viu, e ele
              sugere o que ver depois, explicando o porquê.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/login?modo=cadastro" className="btn-primary px-6 py-2.5 text-base">
                Começar o meu diário
              </Link>
              <Link to="/login" className="font-hand text-2xl font-bold underline">
                Já tenho conta
              </Link>
            </div>
          </div>

          {/* Uma página de diário de exemplo: polaroides, a frase do gosto e o carimbo */}
          <PolaroidCollage>
            <div
              className="postit absolute bottom-0 left-[4%] z-10 hidden w-[44%] max-w-64 rotate-[-4deg] px-5 py-4 sm:block"
              style={{ "--note": "#f6d27a" } as CSSProperties}
            >
              <p className="font-hand text-lg leading-5 font-bold">Meu gosto em uma frase:</p>
              <p className="mt-1 font-display text-lg leading-tight font-bold sm:text-xl">
                Sou do time do drama dos anos 2000.
              </p>
            </div>
            <span className="absolute right-[2%] bottom-[14%] z-10 rotate-[-10deg] rounded-xl border-4 border-[#b9452f] px-4 py-1 font-display text-2xl font-bold text-[#b9452f] sm:text-3xl">
              Visto!
            </span>
          </PolaroidCollage>
        </section>
      </div>

      <main className="mx-auto max-w-[1680px] px-4 pb-16 sm:px-6 lg:px-10">
        <section className="pt-4 pb-8">
          <h2 className="font-display text-3xl font-bold">Como funciona</h2>
          <p className="font-hand text-2xl font-bold text-accent">em quatro passos</p>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="postit px-5 py-5"
                style={{ "--note": step.color, rotate: `${[-1.5, 1, -1, 1.5][i]}deg` } as CSSProperties}
              >
                <span className="font-hand text-4xl leading-none font-bold">{i + 1}</span>
                <h3 className="mt-2 font-display text-xl leading-tight font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="paper relative mt-10 max-w-4xl -rotate-[0.3deg] rounded-sm py-6 pr-6 pl-14">
          <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[2] }} />
          <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>Bom saber:</p>
          <ul className="font-hand text-xl leading-8 font-semibold">
            <li>→ O que você marca como Já vi aparece na Comunidade, para quem tem conta.</li>
            <li>→ Por enquanto são filmes e séries. As músicas vêm depois.</li>
            <li>→ É de graça: é um projeto acadêmico.</li>
          </ul>
        </section>
      </main>

      <footer className="mx-auto max-w-[1680px] space-y-2 px-4 pb-10 text-xs text-muted sm:px-6 lg:px-10">
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="inline-block">
          <img src="/tmdb-logo.svg" alt="TMDB" className="h-3" />
        </a>
        <p>
          Os dados e as imagens dos títulos vêm do TMDB. This product uses the TMDB API but is not endorsed or certified
          by TMDB. As recomendações de filmes usam avaliações do MovieLens, da GroupLens Research, que não endossa este
          projeto.
        </p>
        <p>Criado pela Equipe Gamma na disciplina de Gerência de Projeto 2026.2 da UFAL.</p>
      </footer>
    </div>
  );
}
