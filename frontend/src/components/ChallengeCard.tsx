import { useState } from "react";
import { Link } from "react-router-dom";
import { MEDIA_STYLE, plural } from "../format";
import type { Challenge, Media } from "../types";
import { TAPE_COLORS } from "../ui";
import Polaroid from "./Polaroid";
import Poster from "./Poster";

const INK = "text-[#2b211c]";
const RED_INK = "text-[#b9452f]";

/** O último dia do mês do desafio ("2026-11" -> 30 de novembro) e quantos dias faltam, contando hoje. */
function deadline(month: string, today = new Date()): { label: string; daysLeft: number } {
  const [year, mon] = month.split("-").map(Number);
  const last = new Date(year, mon, 0);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysLeft = Math.max(0, Math.round((last.getTime() - start.getTime()) / 86_400_000) + 1);
  return { label: last.toLocaleDateString("pt-BR", { day: "numeric", month: "long" }), daysLeft };
}

/**
 * O desafio do tema do mês (RFF32) no Início: o tema, o progresso em selos e, ao lado, os próximos títulos do tema
 * que ainda não estão no diário, cada um com o caminho para a página dele.
 */
export default function ChallengeCard({ c, userId, all = [] }: { c: Challenge; userId: number; all?: Media[] }) {
  const [showAll, setShowAll] = useState(false); // o tema inteiro, dentro do cartão
  const done = Math.min(c.done.length, c.goal);
  const { label, daysLeft } = deadline(c.month);
  const slots = Array.from({ length: c.goal }, (_, i) => c.done[i] ?? null);
  return (
    <section
      aria-labelledby="desafio-titulo"
      className={`paper relative -rotate-[0.2deg] rounded-sm py-7 pr-6 pl-14 sm:pr-8 sm:pl-16 ${INK}`}
    >
      <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[1] }} />
      <span aria-hidden className="tape -top-2.5 right-16 rotate-3" style={{ background: TAPE_COLORS[0] }} />
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>Desafio do mês</p>
          <h2 id="desafio-titulo" className="font-display text-3xl leading-tight font-bold sm:text-4xl">
            {c.title}
          </h2>
          {c.description && <p className="mt-2 max-w-xl text-sm leading-6 text-stone-700">{c.description}</p>}

          {c.earned ? (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <p className="rotate-[-6deg] rounded-xl border-4 border-[#b9452f] px-3 py-1 font-display text-xl font-bold text-[#b9452f]">
                🏅 {c.badge}
              </p>
              <p className="text-base">
                Você ganhou o selo deste mês.{" "}
                <Link to={`/pessoas/${userId}`} className="underline hover:text-[#b9452f]">
                  Ver no meu perfil
                </Link>
              </p>
            </div>
          ) : (
            <p className="mt-4 text-base">
              Registre <b>{plural(c.goal, "título", "títulos")}</b> do tema até {label} e ganhe o selo{" "}
              <b>“{c.badge}”</b>.
            </p>
          )}

          {/* Os selos do progresso: cada título registrado ocupa um lugar, com o pôster */}
          <div className="mt-4 flex items-center gap-3">
            <div
              role="progressbar"
              aria-label="Progresso do desafio"
              aria-valuemin={0}
              aria-valuemax={c.goal}
              aria-valuenow={done}
              className="flex gap-2"
            >
              {slots.map((media, i) => (
                <span
                  key={media?.id ?? `vago-${i}`}
                  title={media ? media.title : "Falta registrar"}
                  className={`relative block h-16 w-12 overflow-hidden rounded-sm ${
                    media ? "shadow-md" : "border-2 border-dashed border-stone-400"
                  }`}
                >
                  {media ? (
                    <>
                      <Poster media={media} compact rounded="rounded-none" className="h-full" />
                      <span className="absolute right-0.5 bottom-0.5 rounded-full bg-[#4f7a5c] px-1 text-[10px] font-bold text-white">
                        ✓
                      </span>
                    </>
                  ) : (
                    <span className="flex h-full items-center justify-center font-hand text-2xl font-bold text-stone-400">
                      {i + 1}
                    </span>
                  )}
                </span>
              ))}
            </div>
            <p className="text-sm text-stone-700">
              <b>
                {done} de {c.goal}
              </b>
              {!c.earned && daysLeft > 0 && <> · {plural(daysLeft, "dia", "dias")} para o fim do mês</>}
            </p>
          </div>
        </div>

        {c.next.length > 0 && (
          <div>
            <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>
              {c.earned ? "Selo garantido! Mais do tema, se quiser:" : done > 0 ? "Para continuar:" : "Para começar agora:"}
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-4">
              {c.next.map((media, i) => (
                <li key={media.id} className={`flex flex-col ${i >= 2 ? "max-sm:hidden" : ""}`}>
                  <Link to={`/media/${media.id}`} aria-label={media.title} className="block">
                    <Polaroid position={i} small album={media.type === "album"} straightenOnHover={false}>
                      <Poster media={media} compact rounded="rounded-[1px]" />
                    </Polaroid>
                  </Link>
                  <p className="mt-2 line-clamp-2 text-sm leading-tight font-semibold">{media.title}</p>
                  <p className="text-xs" style={{ color: MEDIA_STYLE[media.type].color }}>
                    {MEDIA_STYLE[media.type].label}
                  </p>
                  <Link to={`/media/${media.id}`} className="btn-ghost mt-2 self-start px-3 py-1 text-xs">
                    {media.type === "album" ? "Abrir o disco" : "Abrir o título"}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {all.length > 0 && (
        <div className="mt-6 border-t border-[#2b211c]/15 pt-4">
          <button
            className="text-sm font-semibold underline hover:text-[#b9452f]"
            aria-expanded={showAll}
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Esconder o tema" : `Ver o tema inteiro (${all.length} títulos)`}
          </button>
          {showAll && (
            <ul className="mt-4 grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-5 lg:grid-cols-8">
              {all.map((media, i) => (
                <li key={media.id}>
                  <Link to={`/media/${media.id}`} className="block">
                    <Polaroid position={i} small album={media.type === "album"} straightenOnHover={false}>
                      <Poster media={media} compact rounded="rounded-[1px]" />
                    </Polaroid>
                    <p className="mt-2 line-clamp-2 text-xs leading-tight font-semibold">{media.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
