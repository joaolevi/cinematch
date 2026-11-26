/**
 * Sessão pipoca: o que cabe agora, conforme a hora do dia de quem usa. De manhã, algo curto; à tarde, uma sessão da
 * tarde; à noite, um filme inteiro; de madrugada, um episódio antes de dormir. Sempre nos serviços da pessoa, se ela
 * marcou algum.
 */
export interface SessionNow {
  key: "manha" | "tarde" | "noite" | "madrugada";
  minutes: number; // a duração máxima
  when: string; // "de manhã"
  text: string; // o que cabe agora
  icon: string;
  sky: string; // as cores do cartão, como o céu de cada hora
  stars: boolean;
}

export function sessionNow(now = new Date()): SessionNow {
  const h = now.getHours();
  if (h >= 5 && h < 12)
    return { key: "manha", minutes: 90, when: "de manhã", text: "algo curto pra começar o dia, até 1h30", icon: "☕", sky: "from-[#4a3424] to-surface", stars: false };
  if (h >= 12 && h < 18)
    return { key: "tarde", minutes: 120, when: "à tarde", text: "uma sessão da tarde, até 2h", icon: "🍿", sky: "from-[#4a2b22] to-surface", stars: false };
  if (h >= 18)
    return { key: "noite", minutes: 150, when: "à noite", text: "cabe na noite, até 2h30", icon: "🌙", sky: "from-[#1a1f38] to-surface", stars: true };
  return { key: "madrugada", minutes: 60, when: "de madrugada", text: "um episódio antes de dormir, até 1h", icon: "✨", sky: "from-[#231a3a] to-surface", stars: true };
}
