import { Link } from "react-router-dom";
import { MEDIA_STYLE, plural } from "../format";
import type { Challenge, Media } from "../types";
import { TAPE_COLORS } from "../ui";
import Carousel from "./Carousel";
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
 * O desafio do tema do mês (RFF32) no Início: o tema, o progresso em selos e, ao lado, o tema inteiro num carrossel,
 * começando pelo que ainda falta. Cada capa ou pôster abre a página do título.
 */
export default function ChallengeCard({ c, userId, all = [] }: { c: Challenge; userId: number; all?: Media[] }) {
  // O tema inteiro, começando pelos próximos que ainda não estão no diário
  const nextIds = new Set(c.next.map((m) => m.id));
  const theme = [...c.next, ...all.filter((m) => !nextIds.has(m.id))];
  const doneIds = new Set(c.done.map((m) => m.id));
  const done = Math.min(c.done.length, c.goal);
  const { label, daysLeft } = deadline(c.month);
  const slots = Array.from({ length: c.goal }, (_, i) => c.done[i] ?? null);
  return (
    <section
      aria-labelledby="desafio-titulo"
      className={`paper relative -rotate-[0.2deg] rounded-sm py-7 pr-6 pl-14 sm:pr-8 sm:pl-16 ${INK}`}
    >
      <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[1] }} />
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

        {theme.length > 0 && (
          <div className="min-w-0">
            <p className={`font-hand text-2xl leading-8 font-bold ${RED_INK}`}>
              {c.earned ? "Selo garantido! Mais do tema, se quiser:" : done > 0 ? "Para continuar:" : "Para começar agora:"}
            </p>
            {/* O tema inteiro num carrossel, começando pelo que ainda falta; o disco ou o pôster já abre a página */}
            <div className="mt-3">
              <Carousel label="títulos do tema do mês">
                {theme.map((media, i) => (
                  <Link
                    key={media.id}
                    to={`/media/${media.id}`}
                    className="group w-32 shrink-0 snap-start pt-2 sm:w-36"
                    aria-label={`${media.title}${doneIds.has(media.id) ? ", já registrado" : ""}`}
                  >
                    <div className="relative">
                      <Polaroid position={i} small album={media.type === "album"}>
                        <Poster media={media} compact rounded="rounded-[1px]" />
                      </Polaroid>
                      {doneIds.has(media.id) && (
                        <span aria-hidden className="absolute top-1 right-1 rounded-full bg-[#4f7a5c] px-1.5 text-xs font-bold text-white">
                          ✓
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-tight font-semibold group-hover:text-[#b9452f] group-hover:underline">
                      {media.title}
                    </p>
                    <p className="text-xs" style={{ color: MEDIA_STYLE[media.type].color }}>
                      {MEDIA_STYLE[media.type].label}
                    </p>
                  </Link>
                ))}
              </Carousel>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
