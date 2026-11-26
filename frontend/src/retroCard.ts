/**
 * Cartão da retrospectiva para compartilhar (RFF05): uma página de caderno colada, em 1080 x 1350, o formato dos
 * stories e do feed. O mesmo desenho da tela: o carimbo do tipo, a frase do gosto com marca-texto, adesivos com as
 * contagens, fitas com os gêneros, post-its com os números, os preferidos em polaroides e desenhos à mão.
 *
 * As capas são desenhadas quando o site delas deixa (pedidas em modo anônimo, para o canvas não ficar bloqueado). Se
 * uma capa não carregar, a polaroide sai com o nome do título escrito à mão, e o cartão sai do mesmo jeito.
 */
import { formatRating } from "./format";
import { periodName, type Retro } from "./retro";
import type { Media } from "./types";

const W = 1080;
const H = 1350;
const INK = "#2b211c";
const RED = "#b9452f";
const PAPER = "#f1e6d6";
const FRAUNCES = "Fraunces, Georgia, serif";
const CAVEAT = "Caveat, cursive";
const NUNITO = "Nunito, system-ui, sans-serif";
const TYPE_COLOR: Record<Media["type"], string> = { movie: "#8fb3c9", series: "#c2a8e6", album: "#8fc09d" };
const TAPES = ["rgba(242,179,61,.75)", "rgba(232,115,90,.7)", "rgba(127,165,139,.75)"];

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

/** Uma imagem de outro site, sem bloquear o canvas. Se não carregar em 4 segundos, fica sem. */
function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

/** Um pedaço de fita adesiva. */
function tape(ctx: CanvasRenderingContext2D, x: number, y: number, deg: number, color: string, w = 120, h = 32) {
  tilted(ctx, x, y, deg, () => {
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
  });
}

/** Uma estrela desenhada à mão, de uma vez só. */
function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
    const wobble = i % 2 ? 1.04 : 0.97;
    const px = cx + Math.cos(a) * r * wobble;
    const py = cy + Math.sin(a) * r * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

/** Um coração desenhado à mão. */
function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.3, cy + s * 0.1, cx - s * 0.9, cy - s * 0.9, cx, cy - s * 0.25);
  ctx.bezierCurveTo(cx + s * 0.9, cy - s * 0.95, cx + s * 1.35, cy + s * 0.05, cx + s * 0.05, cy + s * 0.85);
  ctx.stroke();
  ctx.restore();
}

/** A frase do gosto, quebrando as linhas, com o marca-texto atrás das palavras importantes. Devolve o y do fim. */
function tastePhrase(ctx: CanvasRenderingContext2D, parts: { text: string; marker?: string }[], x: number, y: number, width: number, size: number): number {
  ctx.font = `700 ${size}px ${FRAUNCES}`;
  const words = parts.flatMap((p) => p.text.split(/(?<= )/).filter(Boolean).map((w) => ({ w, marker: p.marker })));
  let cx = x;
  let cy = y;
  for (const { w, marker } of words) {
    const wWidth = ctx.measureText(w).width;
    if (cx + ctx.measureText(w.trimEnd()).width > x + width && cx > x) {
      cx = x;
      cy += size * 1.25;
    }
    if (marker) {
      ctx.fillStyle = marker;
      ctx.fillRect(cx - 4, cy - size * 0.42, ctx.measureText(w.trimEnd()).width + 8, size * 0.5);
    }
    ctx.fillStyle = INK;
    ctx.fillText(w, cx, cy);
    cx += wWidth;
  }
  return cy;
}

/** Uma polaroide com a capa (ou o título à mão, sem capa), a fita e a legenda. */
function polaroid(ctx: CanvasRenderingContext2D, media: Media, img: HTMLImageElement | null, cx: number, cy: number, deg: number, caption: string, n: number) {
  const album = media.type === "album";
  const iw = 150;
  const ih = album ? 150 : 225;
  const fw = iw + 24;
  const fh = ih + 24 + 56;
  tilted(ctx, cx, cy, deg, () => {
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#fbf8f2";
    ctx.fillRect(-fw / 2, -fh / 2, fw, fh);
    ctx.shadowColor = "transparent";
    const ix = -iw / 2;
    const iy = -fh / 2 + 12;
    if (img) {
      // Recorta a capa para caber, sem deformar
      const scale = Math.max(iw / img.width, ih / img.height);
      const sw = iw / scale;
      const sh = ih / scale;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, ix, iy, iw, ih);
    } else {
      ctx.fillStyle = TYPE_COLOR[media.type];
      ctx.fillRect(ix, iy, iw, ih);
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.font = `700 30px ${CAVEAT}`;
      ctx.fillText(fit(ctx, media.title, iw - 20), 0, iy + ih / 2);
    }
    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = `700 32px ${CAVEAT}`;
    ctx.fillText(caption, 0, fh / 2 - 16);
    ctx.textAlign = "left";
  });
  tape(ctx, cx, cy - fh / 2 + 4, deg - 4, TAPES[n % TAPES.length], 100, 30);
}

export async function drawRetroCard(retro: Retro): Promise<Blob> {
  const loved = retro.loved.slice(0, 3);
  const [images] = await Promise.all([
    Promise.all(loved.map((e) => loadImage(e.media.poster_url))),
    ...[`700 80px ${FRAUNCES}`, `700 50px ${CAVEAT}`, `700 36px ${NUNITO}`].map((font) => document.fonts.load(font).catch(() => [])),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";

  // A mesa escura e a página pautada, com a margem vermelha
  ctx.fillStyle = "#17110f";
  ctx.fillRect(0, 0, W, H);
  tilted(ctx, W / 2, H / 2, -0.6, () => {
    ctx.fillStyle = PAPER;
    ctx.shadowColor = "rgba(0,0,0,.5)";
    ctx.shadowBlur = 30;
    ctx.fillRect(-W / 2 + 50, -H / 2 + 50, W - 100, H - 100);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(70,110,160,.16)";
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
  tape(ctx, 210, 52, -6, TAPES[0], 150, 38);
  star(ctx, 900, 205, 46, "#d9a13b");

  const left = 180;
  const width = W - left - 110;

  // O cabeçalho e o carimbo do tipo
  ctx.fillStyle = RED;
  ctx.font = `700 46px ${CAVEAT}`;
  const period = periodName(retro.period);
  ctx.fillText(`Em ${period}, eu fui:`, left, 175);
  ctx.font = `700 64px ${FRAUNCES}`;
  const stampWidth = Math.min(width - 120, ctx.measureText(retro.archetype.name).width + 70);
  tilted(ctx, left + stampWidth / 2, 255, -3, () => {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(-stampWidth / 2, -56, stampWidth, 104, 16);
    ctx.stroke();
    ctx.fillStyle = RED;
    ctx.textAlign = "center";
    ctx.fillText(fit(ctx, retro.archetype.name, stampWidth - 40), 0, 22);
    ctx.textAlign = "left";
  });
  ctx.fillStyle = INK;
  ctx.font = `600 38px ${CAVEAT}`;
  ctx.fillText(fit(ctx, retro.archetype.text, width), left, 360);

  // A frase do gosto, com o marca-texto
  let y = 455;
  if (retro.taste) {
    const parts = [{ text: "Sou do time " }, { text: retro.taste.highlight, marker: "rgba(242,179,61,.6)" }];
    if (retro.taste.decade) parts.push({ text: " dos " }, { text: retro.taste.decade, marker: "rgba(232,115,90,.5)" });
    parts.push({ text: "." });
    y = tastePhrase(ctx, parts, left, y, width, 50) + 40;
  }

  // As contagens em adesivos redondos, e os números em post-its, à direita
  const count = (t: Media["type"]) => retro.entries.filter((e) => e.media.type === t).length;
  const stickers = (
    [
      ["movie", count("movie"), "filmes"],
      ["series", count("series"), "séries"],
      ["album", count("album"), "discos"],
    ] as [Media["type"], number, string][]
  ).filter(([, n]) => n > 0);
  const r = 66;
  stickers.forEach(([type, n, label], i) => {
    tilted(ctx, left + r + i * (2 * r + 22), y + r, [-8, 5, -3][i], () => {
      ctx.shadowColor = "rgba(0,0,0,.25)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = TYPE_COLOR[type];
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.font = `700 52px ${FRAUNCES}`;
      ctx.fillText(String(n), 0, 8);
      ctx.font = `700 30px ${CAVEAT}`;
      ctx.fillText(n === 1 ? label.replace(/s$/, "") : label, 0, 42);
      ctx.textAlign = "left";
    });
  });
  const notes = [
    retro.average != null && { value: formatRating(retro.average), label: "nota média", color: "#f6d27a", deg: 4 },
    retro.age != null && { value: String(retro.age), label: "anos de gosto", color: "#b7d1b9", deg: -5 },
  ].filter(Boolean) as { value: string; label: string; color: string; deg: number }[];
  const ns = 136;
  notes.forEach((note, i) => {
    tilted(ctx, W - 130 - ns / 2 - i * (ns + 20), y + ns / 2 + (i ? 10 : 0), note.deg, () => {
      ctx.shadowColor = "rgba(0,0,0,.22)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 5;
      ctx.fillStyle = note.color;
      ctx.fillRect(-ns / 2, -ns / 2, ns, ns);
      ctx.shadowColor = "transparent";
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.font = `700 64px ${CAVEAT}`;
      ctx.fillText(note.value, 0, 10);
      ctx.font = `700 26px ${CAVEAT}`;
      ctx.fillText(note.label, 0, 46);
      ctx.textAlign = "left";
    });
  });
  y += 2 * r + 50;

  // Os gêneros em fitas: amarelas no que eu vi, verdes no que eu ouvi
  // Dois do que eu vi e dois do que eu ouvi: cabem numa fita só, e as polaroides ficam com o pé da página
  const tags = [...retro.genres.slice(0, 2).map((g) => [g, false] as const), ...retro.musicGenres.slice(0, 2).map((g) => [g, true] as const)];
  let tx = left;
  ctx.font = `700 36px ${CAVEAT}`;
  tags.forEach(([g, heard], i) => {
    const text = `${heard ? "♪ " : ""}${g.toLowerCase()}`;
    const w = ctx.measureText(text).width + 32;
    if (tx + w > left + width) {
      tx = left;
      y += 60;
    }
    tilted(ctx, tx + w / 2, y, [-2, 1.5, -1, 2][i % 4], () => {
      ctx.fillStyle = heard ? "rgba(127,165,139,.6)" : "rgba(242,179,61,.55)";
      ctx.fillRect(-w / 2, -24, w, 46);
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.fillText(text, 0, 11);
      ctx.textAlign = "left";
    });
    tx += w + 14;
  });

  // Os preferidos em polaroides espalhadas no pé da página, com o coração ao lado
  if (loved.length) {
    ctx.fillStyle = RED;
    ctx.font = `700 40px ${CAVEAT}`;
    ctx.fillText("Os que eu mais amei:", left, y + 85);
    heart(ctx, left + 380, y + 72, 20, "#e8735a");
    // O topo das polaroides vem logo abaixo do título; cada uma desce até a metade da própria altura
    const top = y + 130;
    const spots = [
      [left + 100, 0, -6],
      [left + 340, -12, 4],
      [left + 580, 10, -3],
    ] as const;
    loved.forEach((e, i) => {
      const half = (e.media.type === "album" ? 150 : 225) / 2 + 40;
      polaroid(ctx, e.media, images[i], spots[i][0], top + half + spots[i][1], spots[i][2], `nº ${i + 1}`, i);
    });
  }

  // A assinatura
  ctx.fillStyle = INK;
  ctx.font = `700 40px ${FRAUNCES}`;
  ctx.textAlign = "right";
  ctx.fillText("Tastory", W - 105, H - 80);
  ctx.font = `600 28px ${CAVEAT}`;
  ctx.fillStyle = RED;
  ctx.fillText("o diário do meu gosto", W - 105, H - 122);
  ctx.textAlign = "left";

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não deu para gerar o cartão."))), "image/png");
    } catch (e) {
      reject(e as Error);
    }
  });
}
