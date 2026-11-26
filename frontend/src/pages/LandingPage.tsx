import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Logo } from "../components/Layout";
import Polaroid from "../components/Polaroid";
import PolaroidCollage from "../components/PolaroidCollage";
import Poster from "../components/Poster";
import type { Showcase } from "../types";
import { usePageTitle } from "../usePageTitle";

const RED_INK = "text-[#b9452f]";

const STEPS = [
  {
    title: "Conte o que você curte",
    text: "Gêneros, épocas, diretores, artistas e alguns títulos que você já viu ou ouviu. Leva um minuto.",
    color: "#f6d27a",
  },
  {
    title: "Receba sugestões explicadas",
    text: "Cada sugestão diz por que apareceu: “porque você curtiu Cidade de Deus”.",
    color: "#f3a48f",
  },
  {
    title: "Escreva no seu diário",
    text: "Nota, data e resenha. Cada filme vira uma polaroide, e cada disco, um vinil colado no diário.",
    color: "#b7d1b9",
  },
  {
    title: "Descubra o seu gosto",
    text: "Uma frase que resume você, o seu top 10, gráficos e o que a galera anda vendo.",
    color: "#b9d0e4",
  },
];

/** Pares reais do catálogo: o filme e o disco que vem com ele, pela trilha ou pela história de quem canta. */
function SeeThenHear({ pairs }: { pairs: Showcase["pairs"] }) {
  if (pairs.length === 0) return null;
  return (
    <section className="pt-4 pb-8">
      <h2 className="font-display text-3xl font-bold">Para ver e depois ouvir</h2>
      <p className="font-hand text-2xl font-bold text-accent">filmes, séries e discos no mesmo diário</p>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
        O Tastory liga o que você vê ao que você ouve: a trilha sonora do filme, o disco de quem a cinebiografia conta a
        história, o compositor da trilha. Cada ligação vira uma sugestão, sempre com o motivo.
      </p>
      <ul className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {pairs.map((pair, i) => (
          <li key={pair.album.id}>
            <div className="grid grid-cols-2 items-end gap-4">
              <Polaroid position={i * 2} straightenOnHover={false}>
                <Poster media={pair.video} rounded="rounded-[2px]" />
              </Polaroid>
              <Polaroid position={i * 2 + 1} album straightenOnHover={false}>
                <Poster media={pair.album} rounded="rounded-[2px]" />
              </Polaroid>
            </div>
            <p className="mt-3 font-hand text-2xl leading-7 font-bold text-accent">{pair.reason}</p>
            <p className="text-sm text-muted">
              {pair.album.title}
              {pair.album.creators[0] && `, de ${pair.album.creators[0]}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Apresentação para quem ainda não tem conta: o que é o Tastory e como funciona. */
const ASKED = "algo leve para a Sessão da Tarde";
const UNDERSTOOD = ["Leve", "Em família", "Filmes"];

/** O pedido sendo digitado e virando filtros, em loop, como acontece no Para você. */
function AskDemo() {
  const [letters, setLetters] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setLetters(ASKED.length + UNDERSTOOD.length * 6);
      return;
    }
    const t = setInterval(() => setLetters((n) => (n > ASKED.length + 40 ? 0 : n + 1)), 70);
    return () => clearInterval(t);
  }, []);
  const typed = ASKED.slice(0, letters);
  const done = letters >= ASKED.length;
  return (
    <div aria-hidden className="rounded-xl border border-line bg-bg/70 p-4">
      <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
        <span className="text-accent">✦</span>
        <span className="caret truncate text-cream">{typed}</span>
      </div>
      <div className="mt-3 flex min-h-7 flex-wrap gap-1.5 text-xs">
        {done &&
          UNDERSTOOD.map((label, i) => (
            <span key={label} className="rise rounded-full bg-accent/15 px-2.5 py-1 font-semibold text-accent" style={{ "--i": i * 2 } as CSSProperties}>
              {label}
            </span>
          ))}
      </div>
    </div>
  );
}

/** Duas pessoas e a porcentagem que sobe até o quanto elas combinam. */
function TogetherDemo() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return setN(63);
    const t = setInterval(() => setN((x) => (x >= 63 ? 63 : x + 1)), 25);
    return () => clearInterval(t);
  }, []);
  return (
    <div aria-hidden className="flex items-center justify-center gap-4 rounded-xl border border-line bg-bg/70 p-4">
      <div className="flex -space-x-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#8fb3c9] font-bold text-bg ring-2 ring-bg">A</span>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#e59bb0] font-bold text-bg ring-2 ring-bg">B</span>
      </div>
      <p className="font-hand text-3xl leading-none font-bold text-accent">
        Vocês combinam <span className="tabular-nums">{n}%</span>
      </p>
    </div>
  );
}

/** Um cartão da retrospectiva, flutuando, com a frase do gosto. */
function CardDemo() {
  return (
    <div aria-hidden className="grid place-items-center rounded-xl border border-line bg-bg/70 p-4">
      <div className="float paper w-56 rounded-sm py-3 pr-3 pl-9 text-[#2b211c]" style={{ "--tilt": "-3deg" } as CSSProperties}>
        <p className={`font-hand text-sm font-bold ${RED_INK}`}>Minha retrospectiva de 2026</p>
        <p className="font-display text-base leading-tight font-bold">
          Sou do time <mark className="marker marker-draw">da MPB</mark> dos <mark className="marker marker-draw" style={{ "--marker": "rgb(232 115 90 / 0.5)" } as CSSProperties}>anos 70</mark>.
        </p>
      </div>
    </div>
  );
}

/** O que só o Tastory faz, com uma demonstração viva de cada coisa. */
function OnlyHere() {
  const items = [
    { title: "Peça do seu jeito", text: "Escreva o que quer, em português, e o pedido vira clima, ocasião e tempo.", demo: <AskDemo /> },
    { title: "Vejam juntos", text: "Descubra o quanto você combina com quem segue e o que agrada aos dois.", demo: <TogetherDemo /> },
    { title: "Seu ano num cartão", text: "A frase do seu gosto e os favoritos do ano, num cartão para guardar ou mandar.", demo: <CardDemo /> },
  ];
  return (
    <section className="pt-10 pb-4" aria-labelledby="so-aqui">
      <h2 id="so-aqui" className="font-display text-3xl font-bold">
        O que só o Tastory faz
      </h2>
      <p className="font-hand text-xl font-bold text-accent">além de juntar filme, série e disco no mesmo diário</p>
      <ul className="mt-6 grid gap-5 md:grid-cols-3">
        {items.map((item, i) => (
          <li key={item.title} className="rise card flex flex-col gap-4 p-5" style={{ "--i": i } as CSSProperties}>
            {item.demo}
            <div>
              <h3 className="font-display text-xl font-bold">{item.title}</h3>
              <p className="mt-1 text-sm text-stone-300">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function LandingPage() {
  usePageTitle("A história do seu gosto");
  const [showcase, setShowcase] = useState<Showcase | null>(null);
  useEffect(() => {
    api.showcase().then(setShowcase).catch(() => {});
  }, []);
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

        <section aria-labelledby="landing-titulo" className="mx-auto grid max-w-[1680px] items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:px-10 lg:py-14">
          <div>
            <p className={`font-hand text-3xl font-bold ${RED_INK}`}>Querido diário,</p>
            <h1 id="landing-titulo" className="mt-2 font-display text-4xl leading-tight font-bold sm:text-5xl xl:text-6xl">
              A história do <mark className="marker">seu gosto</mark>, título por título.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8">
              O Tastory é um diário de filmes, séries e música que aprende com o que você registra. Você anota o que viu e
              ouviu, e ele sugere o que ver e ouvir depois, explicando o porquê.
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
          <PolaroidCollage withAlbum>
            <div
              className="postit absolute bottom-0 left-[4%] z-10 hidden w-[44%] max-w-64 rotate-[-4deg] px-5 py-4 sm:block"
              style={{ "--note": "#f6d27a" } as CSSProperties}
            >
              <p className="font-hand text-lg leading-5 font-bold">Meu gosto em uma frase:</p>
              <p className="mt-1 font-display text-lg leading-tight font-bold sm:text-xl">
                Sou do time do drama dos anos 2000.
              </p>
            </div>
            <span className="absolute right-[2%] bottom-[14%] z-10 hidden rotate-[-10deg] rounded-xl border-4 border-[#b9452f] px-4 py-1 font-display text-2xl font-bold text-[#b9452f] sm:block sm:text-3xl">
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

        <SeeThenHear pairs={showcase?.pairs ?? []} />

        <OnlyHere />

        {/* Sem papel: a página já tem a folha do topo e os post-its; aqui, só as notas à mão */}
        <section className="mt-10 max-w-4xl border-t border-line/60 pt-6">
          <p className="font-hand text-2xl leading-8 font-bold text-accent">Bom saber:</p>
          <ul className="font-hand text-xl leading-8 font-semibold text-stone-200">
            <li>→ O que você marca como Já vi aparece na Comunidade, e você escolhe quem vê.</li>
            <li>→ Filmes, séries e discos no mesmo diário, com pontes entre eles: o filme e a trilha para ouvir depois.</li>
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
          by TMDB (este produto usa a API do TMDB, mas não é endossado nem certificado por ele). As recomendações de filmes usam avaliações do MovieLens, da GroupLens Research, que não endossa este
          projeto. Os álbuns vêm do MusicBrainz.
        </p>
        <p>Criado pela Equipe Gamma na disciplina de Gerência de Projeto 2026.2 da UFAL.</p>
      </footer>
    </div>
  );
}
