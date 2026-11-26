import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Carousel from "../components/Carousel";
import Highlight from "../components/Highlight";
import MediaCard from "../components/MediaCard";
import Polaroid from "../components/Polaroid";
import Poster from "../components/Poster";
import ArrivalsNote from "../components/ArrivalsNote";
import ChallengeCard from "../components/ChallengeCard";
import RateReminder from "../components/RateReminder";
import SeenModal from "../components/SeenModal";
import SeenStamp from "../components/SeenStamp";
import Toast from "../components/Toast";
import WatchedBy from "../components/WatchedBy";
import { isUpcoming } from "../format";
import { OnScreen, useImpressions } from "../impressions";
import { diaryChanged, seenLabel, useDiaryVersion, useSeen } from "../seen";
import type { Challenge, CommunityEntry, DiaryEntry, Feed, FeedbackAction, Media, Recommendation, UserList } from "../types";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";
import ListName from "../components/ListName";

const SHELF = 16;
const RED_INK = "text-[#b9452f]";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

/** "22/11": cabe na legenda da polaroide pequena, até no celular. */
function shortDate(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** O número do dia de hoje, no fuso de quem usa: muda a aposta do dia à meia-noite. */
function dayNumber(): number {
  const now = new Date();
  return Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86_400_000);
}

/** Cabeçalho de cada seção: título, uma anotação à mão e o link para ver tudo. */
function SectionHeader({
  title,
  note,
  to,
  linkLabel,
  actions,
}: {
  title: ReactNode;
  note?: string;
  to?: string;
  linkLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <h2 className="font-display text-2xl font-bold">
          {title}
          {note && <span className="block font-hand text-xl font-bold text-accent sm:ml-3 sm:inline">{note}</span>}
        </h2>
        {actions}
      </div>
      {to && (
        <Link to={to} className="text-sm font-bold text-accent hover:underline">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

function Shelf(props: {
  title: ReactNode;
  label?: string;
  note?: string;
  to?: string;
  linkLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <SectionHeader {...props} />
      <Carousel label={props.label ?? (typeof props.title === "string" ? props.title : "fileira")}>
        {props.children}
      </Carousel>
    </section>
  );
}

const shelfItem = "w-36 shrink-0 snap-start pt-2 sm:w-40";

/** Página inicial: um resumo de tudo, como a home do Letterboxd ou do Spotify. */
export default function HomePage() {
  usePageTitle("Início");
  const { user } = useAuth();
  const seen = useSeen(user?.id);
  const version = useDiaryVersion();
  const impressions = useImpressions();
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [strategy, setStrategy] = useState<Feed["strategy"]>("hybrid");
  const [trending, setTrending] = useState<Media[]>([]);
  const [upcoming, setUpcoming] = useState<Media[]>([]);
  const [community, setCommunity] = useState<CommunityEntry[]>([]);
  const [watchlist, setWatchlist] = useState<UserList["items"]>([]);
  const [theme, setTheme] = useState<UserList | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [showUpcoming, setShowUpcoming] = useState(false); // a fileira de baixo: em alta ou em breve
  // O desafio do mês muda a cada registro no diário
  useEffect(() => {
    api.challenge().then(setChallenge).catch(() => {});
  }, [version]);
  const [diary, setDiary] = useState<DiaryEntry[] | null>(null);
  const [seenTarget, setSeenTarget] = useState<Media | null>(null);
  const [stamp, setStamp] = useState(0);
  const [stampAlbum, setStampAlbum] = useState(false);
  const [toast, setToast] = useState<ReactNode | null>(null);

  useEffect(() => {
    api
      .feed(undefined, 6)
      .then((f) => {
        setRecs(f.items);
        setStrategy(f.strategy);
      })
      .catch(() => setRecs([]));
    api
      .trending(undefined, SHELF)
      .then(setTrending)
      .catch(() => {});
    api
      .featured()
      .then((shelves) => setTheme(shelves.find((s) => s.items.length > 0) ?? null))
      .catch(() => {});
    api
      .community(5)
      .then((r) => setCommunity(r.items))
      .catch(() => {});
    // Na ordem "mais recentes", o que ainda não estreou fica no fim da lista
    api
      .search({ sort: "year", limit: 1 })
      .then((r) => api.search({ sort: "year", limit: 40, offset: Math.max(0, r.total - 40) }))
      .then((r) => setUpcoming(r.items.filter((m) => isUpcoming(m.year) && m.poster_url).slice(0, SHELF)))
      .catch(() => {});
  }, []);

  const loadWatchlist = () =>
    api
      .lists()
      .then((lists) => setWatchlist(lists.find((l) => l.is_watchlist)?.items ?? []))
      .catch(() => {});

  useEffect(() => {
    loadWatchlist();
    api
      .diary()
      .then(setDiary)
      .catch(() => setDiary([]));
  }, [version]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Mesma regra do feed: a reação só conta se a sugestão tiver aparecido na tela
  async function act(
    media: Media,
    action: FeedbackAction,
    rating?: number | null,
    review?: string,
    date?: string | null,
  ) {
    const rec = recs?.find((r) => r.media.id === media.id);
    if (rec) impressions.mark(rec);
    await impressions.send();
    await api.feedback(media.id, action, rating, review, date);
    setRecs((list) => list?.filter((r) => r.media.id !== media.id) ?? null);
    if (action === "seen") {
      setStampAlbum(media.type === "album");
      setStamp(Date.now());
      diaryChanged();
    }
    if (action === "want") loadWatchlist();
    if (action === "dismiss" && rec) {
      setToast(
        <>
          Combinado, não vamos mais sugerir "{media.title}"
          <button
            className="ml-3 cursor-pointer font-extrabold text-[#b9452f] hover:underline"
            onClick={async () => {
              setToast(null);
              await api.undoDismiss(media.id);
              setRecs((list) => (list && !list.some((r) => r.media.id === media.id) ? [rec, ...list] : list));
            }}
          >
            Desfazer
          </button>
        </>,
      );
      return;
    }
    setToast(
      action === "want" ? (
        <>
          Anotado! "{media.title}" está na sua lista <ListName />
        </>
      ) : (
        `Boa! "${media.title}" entrou no seu diário`
      ),
    );
  }

  // O que a pessoa registrou em outra tela sai da aposta do dia
  // A aposta do dia: uma das cinco melhores sugestões, que muda a cada dia. Assim o Início não repete o destaque do
  // Para você, que é sempre a primeira
  const unseen = (recs ?? []).filter((r) => !seen?.has(r.media.id)).slice(0, 5);
  const hero = unseen.length ? unseen[dayNumber() % unseen.length] : undefined;
  const visto = (id: number) => {
    const label = seenLabel(seen?.get(id));
    return label ? <span className="text-sm">{label}</span> : undefined;
  };

  return (
    <div className="space-y-14">
      <SeenStamp id={stamp} album={stampAlbum} />
      {/* Saudação e aposta do dia ficam juntas: a aposta é a resposta ao "o que vamos ver hoje?" */}
      <div>
        <header>
          <h1 className="text-4xl font-bold">
            {greeting()}, {user?.name.split(" ")[0]}
          </h1>
          <p className="font-hand text-2xl font-bold text-accent">o que vamos ver hoje?</p>
        </header>
        <ArrivalsNote />

        {hero && (
          <section>
            <OnScreen key={hero.media.id} rec={hero} onSeen={impressions.mark}>
              <Highlight
                rec={hero}
                label={strategy === "trending" ? "Em alta agora" : "A aposta do dia"}
                act={act}
                onSeen={() => setSeenTarget(hero.media)}
              />
            </OnScreen>
            <div className="mt-3 text-right">
              <Link to="/para-voce" className="text-sm font-bold text-accent hover:underline">
                Ver todas as sugestões →
              </Link>
            </div>
          </section>
        )}
      </div>

      {/* O desafio do mês vem logo depois da aposta: é o convite do mês, e não um rodapé da prateleira do tema */}
      {theme && challenge && user && <ChallengeCard c={challenge} userId={user.id} all={theme.items.map((i) => i.media)} />}

      {diary && <RateReminder diary={diary} watchlist={watchlist} onSeen={setSeenTarget} />}

      {watchlist.length > 0 && (
        <Shelf
          title={
            <>
              Da minha lista <ListName />
            </>
          }
          label="Da minha lista Quero ver"
          note="pra não esquecer"
          to="/listas"
          linkLabel="Ver lista"
        >
          {watchlist.slice(0, SHELF).map(({ media }) => (
            <div key={media.id} className={shelfItem}>
              <MediaCard media={media} sticker={visto(media.id)} compact />
            </div>
          ))}
        </Shelf>
      )}

      {trending.length > 0 && (
        <Shelf
          title={showUpcoming ? "Em breve" : "Em alta agora"}
          note={showUpcoming ? "pra anotar na agenda" : "o que todo mundo está vendo"}
          to="/buscar"
          linkLabel="Buscar mais"
          actions={
            upcoming.length >= 3 && (
              <div role="group" aria-label="O que mostrar" className="inline-flex rounded-full border border-line bg-bg/40 p-0.5">
                {([
                  [false, "Em alta"],
                  [true, "Em breve"],
                ] as const).map(([value, text]) => (
                  <button
                    key={text}
                    aria-pressed={showUpcoming === value}
                    onClick={() => setShowUpcoming(value)}
                    className={`cursor-pointer rounded-full px-3 py-0.5 text-sm transition ${
                      showUpcoming === value ? "bg-accent font-bold text-bg" : "text-stone-300 hover:text-cream"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>
            )
          }
        >
          {(showUpcoming ? upcoming : trending).map((media) => (
            <div key={media.id} className={shelfItem}>
              <MediaCard media={media} sticker={visto(media.id)} compact />
            </div>
          ))}
        </Shelf>
      )}

      {/* As duas colunas terminam na mesma altura: a folha do diário cresce até o fim da lista da Comunidade */}
      <div className="grid gap-10 lg:grid-cols-2">
        <section className="flex flex-col">
          <SectionHeader title="Do meu diário" to="/diario" linkLabel="Abrir meu diário" />
          <div className="paper relative flex flex-1 -rotate-[0.4deg] flex-col rounded-sm py-6 pr-6 pl-14">
            <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[0] }} />
            {/* A frase do gosto fica no perfil; aqui, só os últimos registros */}
            <p className={`font-hand text-xl leading-8 font-bold ${RED_INK}`}>
              {diary?.length ? "Os últimos que eu registrei:" : "Querido diário,"}
            </p>
            {!diary?.length && (
              <p className="mt-1 font-hand text-2xl leading-8 font-semibold opacity-85">
                Minha história começa quando eu marcar Já vi ou usar o + Registrar, lá em cima.
              </p>
            )}
            {!!diary?.length && (
              <ul className="mt-4 grid grid-cols-4 gap-3 sm:gap-5">
                {diary.slice(0, 4).map((e, position) => (
                  <li key={e.id} className="group">
                    <Link to={`/media/${e.media.id}`} title={e.media.title}>
                      <Polaroid position={position} caption={e.consumed_at ? shortDate(e.consumed_at) : "♥"} album={e.media.type === "album"}>
                        <Poster media={e.media} compact rounded="rounded-[1px]" />
                      </Polaroid>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <SectionHeader title="Na Comunidade" to="/comunidade" linkLabel="Ver a Comunidade" />
          {community.length === 0 ? (
            <p className="text-muted">Ainda não tem registros por aqui.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {community.map((entry) => (
                // O mesmo formato da Comunidade: pôster, título, quem viu com a nota e o começo da resenha
                <li key={entry.id} className="flex gap-4 py-3">
                  <Link to={`/media/${entry.media.id}`} className="w-12 shrink-0 self-start" aria-label={entry.media.title}>
                    <Poster media={entry.media} compact rounded="rounded-md" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/media/${entry.media.id}`} className="font-display font-bold hover:text-accent">
                      {entry.media.title}
                    </Link>
                    <div className="mt-0.5">
                      <WatchedBy
                        name={entry.user_name}
                        userId={entry.user_id}
                        rating={entry.rating}
                        consumedAt={entry.consumed_at}
                        createdAt={entry.created_at}
                      />
                    </div>
                    {entry.review && <p className="mt-1 line-clamp-2 text-sm text-stone-300">{entry.review}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>


      {seenTarget && (
        <SeenModal
          media={seenTarget}
          onClose={() => setSeenTarget(null)}
          onConfirm={async (rating, review, date) => {
            await act(seenTarget, "seen", rating, review, date);
            setSeenTarget(null);
          }}
        />
      )}
      {toast && (
        <Toast>
          <span>{toast}</span>
        </Toast>
      )}
    </div>
  );
}
