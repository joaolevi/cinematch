import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useDiaryVersion } from "../seen";
import type { ReceivedSuggestion } from "../types";
import ListName from "./ListName";
import Poster from "./Poster";
import SocialHead from "./SocialHead";
import { Avatar } from "./WatchedBy";

/** "Bilhetes para você": o pôster com a foto de quem deixou o bilhete, o recado num post-it e o botão de guardar no
 * Quero ver, sempre no pé do cartão, com ou sem recado. */
export default function ReceivedSuggestions() {
  const [items, setItems] = useState<ReceivedSuggestion[]>([]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const version = useDiaryVersion();
  useEffect(() => {
    api.receivedSuggestions().then(setItems).catch(() => {});
  }, [version]);
  return (
    <section aria-labelledby="bilhetes">
      <SocialHead id="bilhetes" title="Bilhetinhos pra você" note="de quem você segue" mode="bilhete" action="Deixar bilhetinho" />
      {items.length === 0 && (
        <p className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-line px-6 text-center text-sm text-muted">
          Quando alguém indicar um filme, uma série ou um disco para você, o bilhetinho aparece aqui.
        </p>
      )}
      <ul className={`-mx-3 flex snap-x gap-5 overflow-x-auto px-3 pb-2 [scrollbar-width:none] ${items.length === 0 ? "hidden" : ""}`}>
        {items.map((s, i) => {
          const kept = s.in_watchlist || saved.has(s.media.id);
          return (
            <li
              key={s.id}
              className="rise relative h-56 w-80 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-surface to-[#2a1d16] p-4"
              style={{ "--i": i } as React.CSSProperties}
            >
              <div className="flex h-full gap-4">
                <Link to={`/media/${s.media.id}`} className="relative w-20 shrink-0 self-start" aria-label={s.media.title}>
                  <Poster media={s.media} compact rounded="rounded-lg" />
                  <span className="absolute -top-2 -left-2 rounded-full ring-2 ring-surface">
                    <Avatar name={s.sender.name} userId={s.sender.id} size="h-8 w-8 text-xs" />
                  </span>
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-xs text-muted">
                    <Link to={`/pessoas/${s.sender.id}`} className="font-bold text-cream hover:text-accent">
                      {s.sender.name.split(" ")[0]}
                    </Link>{" "}
                    deixou um bilhetinho
                  </p>
                  <Link to={`/media/${s.media.id}`} className="mt-0.5 line-clamp-2 font-display font-bold leading-tight hover:text-accent">
                    {s.media.title}
                  </Link>
                  {s.note && (
                    <p className="postit mt-2 mb-3 line-clamp-3 -rotate-2 px-2.5 py-1.5 font-hand text-base leading-5" style={{ "--note": "#f6d27a" } as React.CSSProperties}>
                      “{s.note}”
                    </p>
                  )}
                  <button
                    className={`mt-auto self-start px-3 py-1 text-xs ${kept ? "btn-ghost" : "btn-want"}`}
                    disabled={kept}
                    onClick={async () => {
                      await api.feedback(s.media.id, "want");
                      setSaved(new Set(saved).add(s.media.id));
                    }}
                  >
                    {kept ? (
                      <>
                        Na lista <ListName />
                      </>
                    ) : (
                      "Quero ver"
                    )}
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
