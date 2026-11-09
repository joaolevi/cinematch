/** Carimbo "Visto!" que aparece por um instante quando a pessoa registra um título. */
export default function SeenStamp({ id }: { id: number }) {
  if (id === 0) return null;
  return (
    <div key={id} className="stamp" role="status" aria-live="polite">
      Visto!
    </div>
  );
}
