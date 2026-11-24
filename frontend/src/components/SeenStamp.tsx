/** Carimbo que aparece por um instante quando a pessoa registra um título: "Visto!" ou, num álbum, "Ouvido!". */
export default function SeenStamp({ id, album = false }: { id: number; album?: boolean }) {
  if (id === 0) return null;
  return (
    <div key={id} className="stamp" role="status" aria-live="polite">
      {album ? "Ouvido!" : "Visto!"}
    </div>
  );
}
