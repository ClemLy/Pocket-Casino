import { useEffect, useRef } from 'react';
import { useCasino } from '../store/useCasino';
import { useJuice } from '../store/useJuice';

interface FallingChip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  spin: number;
  face: string;
  edge: string;
  /** Rebonds restants avant disparition. */
  bounces: number;
  life: number;
}

const PALETTE: ReadonlyArray<[string, string]> = [
  ['#d7263d', '#f4ecd8'],
  ['#305c3c', '#f4ecd8'],
  ['#12100d', '#f4ecd8'],
  ['#7b5ea7', '#f2c14e'],
  ['#f2c14e', '#12100d'],
];

const GRAVITY = 0.55;
const FRICTION = 0.995;
const RESTITUTION = 0.42;

function drawChip(ctx: CanvasRenderingContext2D, chip: FallingChip) {
  ctx.save();
  ctx.translate(chip.x, chip.y);
  ctx.rotate(chip.angle);
  ctx.globalAlpha = Math.min(1, chip.life);

  // Corps du jeton
  ctx.fillStyle = chip.face;
  ctx.beginPath();
  ctx.arc(0, 0, chip.radius, 0, Math.PI * 2);
  ctx.fill();

  // Encoches de tranche : six secteurs clairs, comme sur un vrai jeton.
  ctx.fillStyle = chip.edge;
  for (let i = 0; i < 6; i++) {
    const start = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.arc(0, 0, chip.radius, start, start + Math.PI / 6);
    ctx.arc(0, 0, chip.radius * 0.68, start + Math.PI / 6, start, true);
    ctx.closePath();
    ctx.fill();
  }

  // Disque central
  ctx.fillStyle = chip.face;
  ctx.beginPath();
  ctx.arc(0, 0, chip.radius * 0.62, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, chip.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Pluie de jetons en 2D sur les gros gains. Physique volontairement simple
 * (gravité, friction, rebond amorti) : l'objectif est le plaisir immédiat,
 * pas la simulation.
 */
export function ChipRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chipsRef = useRef<FallingChip[]>([]);
  const frameRef = useRef<number>(0);
  const rainToken = useJuice((s) => s.rainToken);
  const rainCount = useJuice((s) => s.rainCount);
  const reducedMotion = useCasino((s) => s.reducedMotion);

  useEffect(() => {
    if (rainToken === 0 || reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = window.innerWidth;
    const height = window.innerHeight;

    for (let i = 0; i < rainCount; i++) {
      const [face, edge] = PALETTE[Math.floor(Math.random() * PALETTE.length)];
      chipsRef.current.push({
        x: Math.random() * width,
        y: -30 - Math.random() * height * 0.6,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3,
        radius: 9 + Math.random() * 8,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.22,
        face,
        edge,
        bounces: 2,
        life: 1,
      });
    }

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      const floor = height - 12;

      chipsRef.current = chipsRef.current.filter((chip) => {
        chip.vy += GRAVITY;
        chip.vx *= FRICTION;
        chip.x += chip.vx;
        chip.y += chip.vy;
        chip.angle += chip.spin;

        if (chip.y + chip.radius > floor) {
          if (chip.bounces > 0) {
            chip.y = floor - chip.radius;
            chip.vy = -chip.vy * RESTITUTION;
            chip.vx *= 0.8;
            chip.spin *= 0.6;
            chip.bounces--;
          } else {
            chip.y = floor - chip.radius;
            chip.vy = 0;
            chip.vx *= 0.86;
            chip.spin *= 0.86;
            chip.life -= 0.02;
          }
        }

        if (chip.life <= 0) return false;
        drawChip(ctx, chip);
        return true;
      });

      if (chipsRef.current.length > 0) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [rainToken, rainCount, reducedMotion]);

  return <canvas ref={canvasRef} className="chip-rain" aria-hidden="true" />;
}
