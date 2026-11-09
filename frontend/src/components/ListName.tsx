/**
 * Nome de lista dentro de uma frase, como uma etiqueta de fita: "Da sua lista [Quero ver]".
 * Sem isso, "Quero ver" se mistura com a frase e parece um verbo.
 */
export default function ListName({ children = "Quero ver" }: { children?: string }) {
  return (
    <span className="mx-0.5 inline-block -rotate-2 bg-coral/85 px-2 font-hand text-[1.1em] leading-tight font-bold text-[#2b211c] [clip-path:polygon(0_8%,4%_0,96%_6%,100%_0,98%_50%,100%_94%,95%_100%,4%_95%,0_100%,2%_50%)]">
      {children}
    </span>
  );
}
