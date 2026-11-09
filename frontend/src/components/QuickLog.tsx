import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { MEDIA_STYLE } from "../format";
import { TAPE_COLORS } from "../ui";
import { useFocusTrap } from "../useFocusTrap";
import { diaryChanged, useSeen } from "../seen";
import type { Media } from "../types";
import CloseButton from "./CloseButton";
import Poster from "./Poster";
import SeenModal from "./SeenModal";
import ListName from "./ListName";

const RESULTS = 8;

function Row({ media, seen, onPick }: { media: Media; seen: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition hover:bg-[#2b211c]/[0.07] focus-visible:bg-[#2b211c]/[0.07]"
      >
        <div className="w-10 shrink-0">
          <Poster media={media} compact rounded="rounded-md" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{media.title}</p>
          <p className="text-xs text-muted">
            <span className="font-bold">{MEDIA_STYLE[media.type].label}</span>
            {media.year && <span className="text-muted"> {media.year}</span>}
          </p>
        </div>
        {seen && (
          <span className="-rotate-3 rounded-md border-2 border-[#b9452f] px-1.5 py-0.5 font-display text-[11px] font-bold text-[#b9452f]">
            Visto
          </span>
        )}
      </button>
    </li>
  );
}

/**
 * Registrar no diário de qualquer tela: busca o título e abre a mesma janela do "Já vi".
 * Usa POST /diary, e não o feedback, para não contar na taxa de aceitação: o título não veio de uma sugestão.
 */
export default function QuickLog({ onClose, onSaved }: { onClose: () => void; onSaved: (media: Media) => void }) {
  const { user } = useAuth();
  const seen = useSeen(user?.id);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Media[] | null>(null);
  const [resultsFor, setResultsFor] = useState(""); // termo que gerou `results`
  const [watchlist, setWatchlist] = useState<Media[]>([]);
  const [picked, setPicked] = useState<Media | null>(null);
  const latest = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, !picked);

  useEffect(() => {
    api
      .lists()
      .then((lists) =>
        setWatchlist(
          lists
            .find((l) => l.is_watchlist)
            ?.items.map((i) => i.media)
            .slice(0, RESULTS) ?? [],
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      latest.current++; // uma busca a caminho não pode mais trocar a lista
      setResults(null);
      setResultsFor("");
      return;
    }
    const thisSearch = ++latest.current;
    const timer = setTimeout(() => {
      api
        .search({ q: term, limit: RESULTS })
        .then((r) => {
          if (thisSearch !== latest.current) return;
          setResults(r.items);
          setResultsFor(term);
        })
        .catch(() => {
          if (thisSearch !== latest.current) return;
          setResults([]);
          setResultsFor(term);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !picked && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, picked]);

  if (picked && seen == null) {
    // Sem o diário carregado, não dá para saber se o título já tem nota e resenha: espera em vez de abrir vazio
    return (
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh]"
        role="dialog"
        aria-modal="true"
      >
        <div className="paper relative w-full max-w-lg rounded-sm py-6 pr-6 pl-14">
          <p className="font-hand text-2xl font-bold text-[#b9452f]">Abrindo o meu diário...</p>
          <button className="btn-ghost mt-4" onClick={() => setPicked(null)}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  if (picked) {
    const entry = seen?.get(picked.id);
    return (
      <SeenModal
        media={picked}
        initialRating={entry?.rating ?? null}
        initialReview={entry?.review ?? ""}
        initialDate={entry?.consumed_at ?? null}
        onClose={() => setPicked(null)}
        onConfirm={async (rating, review, date) => {
          if (entry)
            await api.updateDiary(entry.id, {
              rating,
              review,
              consumed_at: date,
            });
          else await api.addDiary(picked.id, rating, review, date);
          diaryChanged();
          onSaved(picked);
        }}
      />
    );
  }

  const list = results ?? watchlist;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quicklog-title"
    >
      <div
        ref={box}
        className="paper relative w-full max-w-lg -rotate-[0.6deg] rounded-sm pt-6 pr-6 pb-8 pl-14"
        onClick={(e) => e.stopPropagation()}
      >
        <span
          aria-hidden
          className="tape -top-2 left-1/2 -translate-x-1/2 -rotate-2"
          style={{ background: TAPE_COLORS[2] }}
        />
        <CloseButton onClick={onClose} />
        <p className="font-hand text-2xl leading-none font-bold text-[#b9452f]">Querido diário,</p>
        <h2 id="quicklog-title" className="mt-1 font-display text-xl font-bold">
          O que eu vi?
        </h2>
        <input
          autoFocus
          className="input mt-4"
          placeholder="Busque um filme ou uma série"
          aria-label="Busque um filme ou uma série"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            // Enter escolhe o primeiro da lista, para registrar sem tirar a mão do teclado
            if (e.key !== "Enter") return;
            // Só escolhe o que está na tela para o termo digitado; com a busca ainda a caminho, não faz nada
            const term = q.trim();
            const ready = term ? (resultsFor === term ? results : null) : watchlist;
            if (ready?.[0]) setPicked(ready[0]);
          }}
        />
        {results == null && watchlist.length > 0 && (
          <p className="mt-4 font-hand text-xl leading-6 font-bold text-[#b9452f]">
            Da minha lista <ListName />
          </p>
        )}
        {results?.length === 0 && <p className="mt-4 font-hand text-xl font-semibold">Nada com esse nome por aqui.</p>}
        <ul className="mt-2 mb-1 max-h-[50vh] space-y-1 overflow-y-auto">
          {list.map((m) => (
            <Row key={m.id} media={m} seen={!!seen?.has(m.id)} onPick={() => setPicked(m)} />
          ))}
        </ul>
      </div>
    </div>
  );
}
