/**
 * Cartão da retrospectiva para compartilhar (RFF05): uma folha do diário em 1080 x 1350, o formato dos stories e do
 * feed. É desenhado em canvas, só com texto e formas, para a imagem não depender das capas de outros sites.
 */
import { formatRating } from "./format";
import { periodName, type Retro } from "./retro";

const W = 1080;
const H = 1350;
const INK = "#2b211c";
const RED = "#b9452f";
const NOTES = ["#f6d27a", "#f3a48f", "#b7d1b9"];
const FRAUNCES = "Fraunces, Georgia, serif";
const CAVEAT = "Caveat, cursive";
const NUNITO = "Nunito, system-ui, sans-serif";

/** Quebra o texto em linhas que cabem na largura. */
function lines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Corta com reticências o que não cabe numa linha. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function tilted(ctx: CanvasRenderingContext2D, x: number, y: number, degrees: number, draw: () => void) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((degrees * Math.PI) / 180);
  draw();
  ctx.restore();
}

export async function drawRetroCard(retro: Retro): Promise<Blob> {
  await Promise.all(
    [`700 80px ${FRAUNCES}`, `700 50px ${CAVEAT}`, `700 36px ${NUNITO}`].map((font) => document.fonts.load(font).catch(() => [])),
  );
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";

  // Mesa escura e a folha pautada, com a margem vermelha e duas fitas
  ctx.fillStyle = "#17110f";
  ctx.fillRect(0, 0, W, H);
  tilted(ctx, W / 2, H / 2, -0.6, () => {
    ctx.fillStyle = "#f1e6d6";
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = 30;
    ctx.fillRect(-W / 2 + 50, -H / 2 + 50, W - 100, H - 100);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(70,110,160,.18)";
    ctx.lineWidth = 2;
    for (let y = -H / 2 + 170; y < H / 2 - 60; y += 52) {
      ctx.beginPath();
      ctx.moveTo(-W / 2 + 50, y);
      ctx.lineTo(W / 2 - 50, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(185,69,47,.45)";
    ctx.beginPath();
    ctx.moveTo(-W / 2 + 140, -H / 2 + 50);
    ctx.lineTo(-W / 2 + 140, H / 2 - 50);
    ctx.stroke();
  });
  for (const [x, y, deg, color] of [
    [200, 50, -6, "rgba(242,179,61,.75)"],
    [860, 52, 4, "rgba(127,165,139,.75)"],
  ] as const) {
    tilted(ctx, x, y, deg, () => {
      ctx.fillStyle = color;
      ctx.fillRect(-70, -18, 140, 36);
    });
  }

  const left = 180;
  const width = W - left - 110;
  let y = 175;

  // Cabeçalho
  ctx.fillStyle = RED;
  ctx.font = `700 50px ${CAVEAT}`;
  ctx.fillText("Minha retrospectiva de", left, y);
  y += 88;
  ctx.fillStyle = INK;
  ctx.font = `700 80px ${FRAUNCES}`;
  const title = periodName(retro.period);
  ctx.fillText(fit(ctx, title.charAt(0).toUpperCase() + title.slice(1), width), left, y);

  // Arquétipo, como um carimbo
  y += 120;
  ctx.font = `700 54px ${FRAUNCES}`;
  const stampWidth = Math.min(width, ctx.measureText(retro.archetype.name).width + 70);
  tilted(ctx, left + stampWidth / 2, y - 18, -3, () => {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-stampWidth / 2, -50, stampWidth, 92, 14);
    ctx.stroke();
    ctx.fillStyle = RED;
    ctx.textAlign = "center";
    ctx.fillText(fit(ctx, retro.archetype.name, stampWidth - 40), 0, 18);
    ctx.textAlign = "left";
  });
  y += 82;
  ctx.fillStyle = INK;
  ctx.font = `600 40px ${CAVEAT}`;
  for (const line of lines(ctx, retro.archetype.text, width).slice(0, 2)) {
    ctx.fillText(line, left, y);
    y += 46;
  }

  // A frase do gosto
  if (retro.taste) {
    y += 22;
    ctx.font = `700 46px ${FRAUNCES}`;
    const decade = retro.taste.decade ? ` dos ${retro.taste.decade}` : "";
    for (const line of lines(ctx, `Sou do time ${retro.taste.highlight}${decade}.`, width).slice(0, 2)) {
      ctx.fillText(line, left, y);
      y += 58;
    }
  }

  // Os números em post-its
  y += 24;
  const notes = [
    { value: String(retro.entries.length), label: retro.entries.length === 1 ? "registro" : "registros" },
    { value: retro.average != null ? formatRating(retro.average) : "–", label: "nota média" },
    { value: retro.age != null ? String(retro.age) : "–", label: retro.age === 1 ? "ano: a idade do meu gosto" : "anos: a idade do meu gosto" },
  ];
  const size = 230;
  const gap = (width - size * 3) / 2;
  notes.forEach((note, i) => {
    tilted(ctx, left + i * (size + gap) + size / 2, y + size / 2, [-3, 2, -1.5][i], () => {
      ctx.fillStyle = NOTES[i];
      ctx.shadowColor = "rgba(0,0,0,.18)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.shadowColor = "transparent";
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.font = `700 92px ${CAVEAT}`;
      ctx.fillText(note.value, 0, 8);
      ctx.font = `600 32px ${CAVEAT}`;
      lines(ctx, note.label, size - 30)
        .slice(0, 2)
        .forEach((line, n) => ctx.fillText(line, 0, 58 + n * 32));
      ctx.textAlign = "left";
    });
  });
  y += size + 80;

  // Os que mais amei
  if (retro.loved.length) {
    ctx.fillStyle = RED;
    ctx.font = `700 44px ${CAVEAT}`;
    ctx.fillText("Os que eu mais amei:", left, y);
    y += 56;
    retro.loved.slice(0, 3).forEach((entry, i) => {
      ctx.fillStyle = INK;
      ctx.font = `700 36px ${NUNITO}`;
      const stars = "★".repeat(Math.round(entry.rating ?? 0));
      ctx.fillText(fit(ctx, `${i + 1}. ${entry.media.title}`, width - 200), left, y);
      ctx.fillStyle = "#d9952a";
      ctx.font = `700 32px ${NUNITO}`;
      ctx.textAlign = "right";
      ctx.fillText(stars, left + width, y);
      ctx.textAlign = "left";
      y += 50;
    });
  }

  // Assinatura
  ctx.fillStyle = INK;
  ctx.font = `700 44px ${FRAUNCES}`;
  ctx.textAlign = "right";
  ctx.fillText("Tastory", W - 110, H - 95);
  ctx.font = `600 30px ${CAVEAT}`;
  ctx.fillStyle = RED;
  ctx.fillText("o diário do meu gosto", W - 110, H - 140);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não deu para gerar o cartão."))), "image/png"));
}
