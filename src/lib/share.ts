/**
 * Share card rendering.
 *
 * Drawn on a canvas at a portrait aspect ratio that suits stories and messaging
 * apps, then handed to the native share sheet on mobile or downloaded on desktop.
 */

import type { GameDef } from './games';
import type { Ticket } from './constraints';

const W = 1080;
const H = 1350;

export interface CardInput {
  game: GameDef;
  ticket: Ticket;
  seed: string | null;
  bias: number;
}

export async function renderCard({ game, ticket, seed, bias }: CardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  // Void ground with an aurora wash, matching the app.
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, W, H);
  wash(ctx, W * 0.2, H * 0.18, W * 0.75, '#7c3aed', 0.5);
  wash(ctx, W * 0.85, H * 0.72, W * 0.7, '#22d3ee', 0.35);
  wash(ctx, W * 0.5, H * 0.45, W * 0.6, game.accent.from, 0.16);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 220; i++) {
    const r = Math.random() * 1.8 + 0.4;
    ctx.globalAlpha = Math.random() * 0.6 + 0.15;
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';

  ctx.fillStyle = '#a7a9c4';
  ctx.font = '600 34px ui-sans-serif, system-ui, sans-serif';
  ctx.letterSpacing = '8px';
  ctx.fillText('ORRERY', W / 2, 150);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = '#f4f4ff';
  ctx.font = '800 76px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(game.name, W / 2, 250);

  // Two rows: five white balls, then the special ball on its own.
  const r = 82;
  const gap = 30;
  const total = ticket.white.length * (r * 2) + (ticket.white.length - 1) * gap;
  let x = (W - total) / 2 + r;
  const y = H / 2 - 60;

  for (const n of ticket.white) {
    ball(ctx, x, y, r, n, '#ffffff', '#a78bfa');
    x += r * 2 + gap;
  }
  ball(ctx, W / 2, y + r * 2 + 70, r, ticket.special, '#ffffff', game.accent.to, game.accent.from);

  ctx.fillStyle = '#a7a9c4';
  ctx.font = '400 32px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(game.specialName, W / 2, y + r * 2 + 200);

  const bits = [
    bias === 0 ? 'Fair draw' : bias > 0 ? `Hot bias ${bias}` : `Cold bias ${-bias}`,
  ];
  if (seed) bits.push(`seed ${seed}`);
  ctx.fillStyle = '#6f7192';
  ctx.font = '500 30px ui-monospace, monospace';
  ctx.fillText(bits.join('  ·  '), W / 2, H - 150);

  ctx.font = '400 26px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('For entertainment — every number is equally likely.', W / 2, H - 90);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not render the card.'))),
      'image/png',
    );
  });
}

function wash(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha: number,
) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, hexWithAlpha(color, alpha));
  g.addColorStop(1, hexWithAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function hexWithAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function ball(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  value: number,
  inner: string,
  outer: string,
  mid?: string,
) {
  ctx.save();
  ctx.shadowColor = hexWithAlpha(outer, 0.65);
  ctx.shadowBlur = 46;

  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, inner);
  if (mid) g.addColorStop(0.45, mid);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Specular highlight.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.3, cy - r * 0.38, r * 0.26, r * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#05060f';
  ctx.font = `800 ${Math.round(r * 0.92)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), cx, cy + 2);
  ctx.textBaseline = 'alphabetic';
}

/**
 * Offer the card to the user. Prefers the native share sheet, which is the natural
 * path on a phone, and falls back to a download everywhere else.
 */
export async function shareCard(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (err) {
      // A user cancelling the sheet is not an error worth reporting.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
