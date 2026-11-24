import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import ExperimentsToggle from "../components/ExperimentsToggle";
import { TAPE_COLORS } from "../ui";
import { usePageTitle } from "../usePageTitle";

function Part({ title, children, tape = 0 }: { title: string; children: ReactNode; tape?: number }) {
  return (
    <section className="paper relative -rotate-[0.2deg] rounded-sm py-6 pr-6 pl-14 text-[#2b211c] sm:pl-16">
      <span aria-hidden className="tape -top-2.5 left-12 -rotate-6" style={{ background: TAPE_COLORS[tape] }} />
      <h2 className="font-hand text-2xl leading-8 font-bold text-[#b9452f]">{title}</h2>
      <div className="mt-1 space-y-2 text-sm leading-6">{children}</div>
    </section>
  );
}

/** Minha conta: baixar os próprios dados, sair dos experimentos e excluir a conta (RFF06, RFF17). */
export default function AccountPage() {
  usePageTitle("Minha conta");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  if (!user) return null;

  async function download() {
    setExporting(true);
    setExportError(null);
    try {
      const data = await api.exportMyData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `tastory-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function remove(event: FormEvent) {
    event.preventDefault();
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteMyAccount(password);
      logout();
      navigate("/bem-vindo");
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Minha conta</h1>
        <p className="mt-1 text-muted">
          {user.name} · {user.email}
        </p>
      </div>

      <Part title="Meus dados" tape={0}>
        <p>
          Baixe tudo o que o Tastory guarda sobre você, num arquivo JSON: o diário com notas e resenhas, as listas, as
          preferências do começo, quem você segue e as sugestões que você viu e o que fez com elas. A senha não vai junto.
        </p>
        <button className="btn-primary mt-2" disabled={exporting} onClick={download}>
          {exporting ? "Juntando seus dados..." : "Baixar meus dados"}
        </button>
        {exportError && <p className="text-red-700">{exportError}</p>}
      </Part>

      <Part title="Experimentos" tape={2}>
        <p>
          Comparamos duas formas de sugerir filmes e séries. Saiba mais em{" "}
          <Link to="/como-recomendamos" className="underline hover:text-[#b9452f]">
            Como recomendamos
          </Link>
          .
        </p>
        <ExperimentsToggle />
      </Part>

      <Part title="Excluir minha conta" tape={1}>
        {user.role === "admin" ? (
          <p>Contas de administração não podem ser excluídas por aqui.</p>
        ) : (
          <form onSubmit={remove} className="space-y-3">
            <p>
              Apaga a conta e tudo o que é dela: diário, listas, preferências, quem você segue e o histórico de
              sugestões. Não dá para desfazer. Se quiser guardar alguma coisa, baixe seus dados antes.
            </p>
            <label className="block">
              <span className="font-semibold">Para confirmar, digite sua senha</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full max-w-xs rounded-md border border-stone-400 bg-white/70 px-3 py-2 text-[#2b211c]"
              />
            </label>
            <button type="submit" className="btn-primary bg-[#b42318]! text-white!" disabled={deleting || !password}>
              {deleting ? "Excluindo..." : "Excluir minha conta"}
            </button>
            {deleteError && <p className="text-red-700">{deleteError}</p>}
          </form>
        )}
      </Part>
    </div>
  );
}
