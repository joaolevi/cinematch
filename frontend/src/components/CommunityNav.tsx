import { NavLink } from "react-router-dom";

/** As duas páginas da Comunidade, como no Letterboxd: o que as pessoas registram e as próprias pessoas. */
export default function CommunityNav() {
  const item = ({ isActive }: { isActive: boolean }) =>
    `-mb-px border-b-2 px-1 pb-2 text-sm font-semibold transition ${
      isActive ? "border-accent text-accent" : "border-transparent text-stone-300 hover:text-cream"
    }`;
  return (
    <nav aria-label="Seções da Comunidade" className="mt-5 flex justify-center gap-8 border-b border-line/60">
      <NavLink to="/comunidade" end className={item}>
        Atividade
      </NavLink>
      <NavLink to="/comunidade/pessoas" className={item}>
        Pessoas
      </NavLink>
    </nav>
  );
}
