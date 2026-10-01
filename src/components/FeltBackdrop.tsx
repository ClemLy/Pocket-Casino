import { useEffect, useRef } from 'react';

/** Taille d'un pixel d'art en pixels CSS. Doit rester alignee sur `--px`. */
const ART_PIXEL = 3;

/** Rampe du plus sombre (bord de salle) au plus clair (sous la lampe). */
const RAMP = ['#040908', '#051a15', '#08241d', '#0c3127', '#114233', '#175641', '#1e6c51'];

/** Matrice de Bayer 4x4 : le tramage ordonne des consoles 16 bits. */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => v / 16));

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const RAMP_RGB = RAMP.map(hexToRgb);

/** Bruit deterministe : la fibre du feutre ne doit pas scintiller au resize. */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function paint(canvas: HTMLCanvasElement) {
  const w = Math.ceil(window.innerWidth / ART_PIXEL);
  const h = Math.ceil(window.innerHeight / ART_PIXEL);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const image = ctx.createImageData(w, h);
  const data = image.data;
  const top = RAMP_RGB.length - 1;

  // La lampe est suspendue au-dessus du centre de la table, un peu hors champ.
  const cx = w * 0.5;
  const cy = h * 0.18;
  const rx = Math.max(w * 0.62, 260);
  const ry = Math.max(h * 0.95, 220);

  for (let y = 0; y < h; y++) {
    const bayerRow = BAYER[y & 3];
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const falloff = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      // Courbe douce : un plateau eclaire, puis une chute vers les bords.
      const light = Math.pow(falloff, 1.25);
      const fiber = (hash(x, y) - 0.5) * 0.55;
      const level = light * top + fiber + bayerRow[x & 3] - 0.5;
      const index = Math.min(top, Math.max(0, Math.round(level)));
      const [r, g, b] = RAMP_RGB[index];
      const o = (y * w + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

/**
 * Fond de salle peint une fois par taille de fenetre, en basse definition et
 * agrandi sans lissage. Rien n'est anime : la lumiere reste posee, c'est le
 * jeu qui bouge.
 */
export function FeltBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    paint(canvas);

    let frame = 0;
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => paint(canvas));
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} className="backdrop" aria-hidden="true" />;
}
