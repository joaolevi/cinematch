import { useState } from "react";

/** A resenha com spoiler começa escondida, como no Letterboxd: quem quiser, mostra. */
export default function SpoilerText({ text, spoiler, className = "" }: { text: string; spoiler?: boolean; className?: string }) {
  const [shown, setShown] = useState(!spoiler);
  if (shown) return <p className={`break-words whitespace-pre-line ${className}`}>{text}</p>;
  return (
    <p className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="rounded-md border border-[#b9452f] px-2 py-0.5 text-xs font-bold text-[#e8735a]">Spoiler</span>
      <span className="text-sm text-muted">Esta resenha conta o que acontece.</span>
      <button className="text-sm font-semibold text-accent underline" onClick={() => setShown(true)}>
        Mostrar mesmo assim
      </button>
    </p>
  );
}
