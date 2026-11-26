import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

/** Sair ou voltar para os experimentos (RFF17). Quem sai recebe o recomendador completo e fica fora da comparação. */
export default function ExperimentsToggle() {
  const { user, refresh } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;
  const inside = user.in_experiments;
  return (
    <div>
      <p>
        {inside ? (
          <>
            Sua conta está no grupo <strong>{user.ab_group}</strong>
            {user.ab_group === "A"
              ? ", que recebe o recomendador completo: o seu gosto somado ao de quem é parecido com você."
              : ", que recebe sugestões só pelo que você curte, sem o gosto de outras pessoas."}
          </>
        ) : (
          "Sua conta está fora dos experimentos: você recebe as sugestões completas, e as suas reações não entram na comparação."
        )}
      </p>
      <button
        className="btn-ghost mt-3 px-4 py-1.5 text-sm"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          setError(null);
          try {
            await api.setExperiments(!inside);
            await refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {inside ? "Sair dos experimentos" : "Voltar para os experimentos"}
      </button>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
