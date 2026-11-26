import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DiaryEntry, Media, UserList } from "../types";
import { diaryChanged } from "../seen";
import Poster from "./Poster";
import QuickRate from "./QuickRate";

const UNRATED = 2; // quantos "Que nota você dá?" de uma vez
const ASK_AFTER_DAYS = 7; // o "Já viu?" só aparece depois de uma semana no Quero ver
const SNOOZE_DAYS = { rate: 14, seen: 7 };
const DAY = 86_400_000;

/** Datas sem fuso (o SQLite não guarda) são UTC, como a API grava. */
const parseUtc = (date: string) => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(date) ? date : `${date}Z`);

/** Lembretes adiados ficam só neste navegador; se o armazenamento falhar, o lembrete só volta a aparecer. */
function snoozedUntil(key: string): number {
  try {
    return Number(localStorage.getItem(`tastory.lembrete.${key}`)) || 0;
  } catch {
    return 0;
  }
}

function snooze(key: string, days: number) {
  try {
    localStorage.setItem(`tastory.lembrete.${key}`, String(Date.now() + days * DAY));
  } catch {
    // sem armazenamento, o lembrete volta na próxima visita
  }
}

/**
 * "Antes que eu esqueça": pede a nota do que foi visto sem nota e pergunta "Já viu?" do que está há dias no Quero ver
 * (RFF03). Nada aqui é obrigatório: "Agora não" e "Ainda não" adiam o lembrete.
 */
export default function RateReminder({
  diary,
  watchlist,
  onSeen,
}: {
  diary: DiaryEntry[];
  watchlist: UserList["items"];
  onSeen: (media: Media) => void;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const now = Date.now();

  const unrated = useMemo(
    () =>
      diary
        .filter((e) => e.rating == null && snoozedUntil(`nota.${e.id}`) < now)
        // O que foi visto de verdade vem antes do que foi marcado no questionário do começo
        .sort((a, b) => Number(a.from_onboarding) - Number(b.from_onboarding) || b.created_at.localeCompare(a.created_at))
        .slice(0, UNRATED),
    [diary],
  );
  const stale = useMemo(() => {
    const inDiary = new Set(diary.map((e) => e.media.id));
    return watchlist
      .filter(({ media, added_at }) => !inDiary.has(media.id) && now - parseUtc(added_at) >= ASK_AFTER_DAYS * DAY)
      .filter(({ media }) => snoozedUntil(`viu.${media.id}`) < now)
      .sort((a, b) => a.added_at.localeCompare(b.added_at))[0];
  }, [diary, watchlist]);

  const items = [
    ...unrated.map((e) => ({ key: `nota.${e.id}`, entry: e })),
    ...(stale ? [{ key: `viu.${stale.media.id}`, entry: null }] : []),
  ].filter((item) => !hidden.has(item.key));
  if (items.length === 0) return null;

  const hide = (key: string, days: number) => {
    snooze(key, days);
    setHidden((h) => new Set(h).add(key));
  };

  return (
    // Um lembrete, não um destaque: fica num cartão escuro e discreto, sem folha nem fita
    <section className="card px-5 py-4">
      <h2 className="font-hand text-xl leading-7 font-bold text-accent">Antes que eu esqueça...</h2>
      <ul className="mt-2 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {items.map(({ key, entry }) => {
          if (entry) {
            const album = entry.media.type === "album";
            return (
              <li key={key} className="flex gap-3">
                <Link to={`/media/${entry.media.id}`} className="w-14 shrink-0" aria-label={entry.media.title}>
                  <Poster media={entry.media} compact rounded="rounded-md" />
                </Link>
                <div className="min-w-0">
                  <p className="font-semibold">
                    Que nota você dá para <span className="font-bold">{entry.media.title}</span>?
                  </p>
                  <p className="text-xs text-muted">
                    {entry.from_onboarding
                      ? "Você marcou no começo que curtiu."
                      : `Você ${album ? "ouviu" : "viu"} e não deu nota.`}
                  </p>
                  <div className="mt-1.5">
                    <QuickRate
                      entryId={entry.id}
                      title={entry.media.title}
                      onRated={() =>
                        // Dá tempo de ver "Nota salva" antes de o lembrete sair e o resto do Início se atualizar
                        setTimeout(() => {
                          setHidden((h) => new Set(h).add(key));
                          diaryChanged();
                        }, 1500)
                      }
                    />
                  </div>
                  <button className="mt-1 cursor-pointer text-xs font-bold text-muted hover:text-accent hover:underline" onClick={() => hide(key, SNOOZE_DAYS.rate)}>
                    Agora não
                  </button>
                </div>
              </li>
            );
          }
          const { media, added_at } = stale!;
          const album = media.type === "album";
          const days = Math.floor((now - parseUtc(added_at)) / DAY);
          return (
            <li key={key} className="flex gap-3">
              <Link to={`/media/${media.id}`} className="w-14 shrink-0" aria-label={media.title}>
                <Poster media={media} compact rounded="rounded-md" />
              </Link>
              <div className="min-w-0">
                <p className="font-semibold">
                  Já {album ? "ouviu" : "viu"} <span className="font-bold">{media.title}</span>?
                </p>
                <p className="text-xs text-muted">Está na sua lista Quero ver há {days} dias.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="btn-primary px-3 py-1 text-sm" onClick={() => onSeen(media)}>
                    {album ? "Já ouvi" : "Já vi"}
                  </button>
                  <button className="btn-ghost px-3 py-1 text-sm" onClick={() => hide(key, SNOOZE_DAYS.seen)}>
                    Ainda não
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
