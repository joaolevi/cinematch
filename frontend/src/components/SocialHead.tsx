import ShareButton, { type ShareMode } from "./ShareButton";

/** O cabeçalho das seções sociais do Início: o título, a frase à mão e o botão de criar, que abre a janela de Compartilhar
 * já pedindo o título. Usado em "Bora juntos?" e "Bilhetinhos pra você", para as duas ficarem alinhadas. */
export default function SocialHead({ id, title, note, mode, action }: { id: string; title: string; note: string; mode: ShareMode; action: string }) {
  return (
    <div className="mb-4 flex min-h-16 flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <h2 id={id} className="font-display text-2xl font-bold">
        {title}
        <span className="block font-hand text-xl font-bold text-accent">{note}</span>
      </h2>
      <ShareButton
        initialMode={mode}
        trigger={(open) => (
          <button className="btn-ghost shrink-0 px-3 py-1.5 text-sm" onClick={open}>
            <span aria-hidden>+</span> {action}
          </button>
        )}
      />
    </div>
  );
}
