import { useEffect, useRef } from 'react';

/**
 * Parallax starfield.
 *
 * Written to be cheap on a phone: the particle budget scales with viewport area,
 * device pixel ratio is capped at 2, the loop stops entirely when the tab is hidden,
 * and `prefers-reduced-motion` skips the canvas altogether in favour of the static
 * aurora gradients underneath.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let stars: { x: number; y: number; z: number; r: number }[] = [];
    let w = 0;
    let h = 0;

    const layout = () => {
      // Cap DPR at 2 — a phone at DPR 3 paints 2.25x the pixels for no visible gain.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Roughly one star per 9000 css px², bounded so phones stay light and
      // very large desktops do not get a sparse-looking sky.
      const count = Math.round(Math.min(Math.max((w * h) / 9000, 60), 320));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.8 + 0.2,
        r: Math.random() * 1.1 + 0.3,
      }));
    };

    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(now - last, 50);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        // Nearer stars drift faster, which reads as depth.
        s.y += s.z * dt * 0.006;
        if (s.y > h + 2) {
          s.y = -2;
          s.x = Math.random() * w;
        }
        ctx.globalAlpha = 0.25 + s.z * 0.6;
        ctx.fillStyle = s.z > 0.75 ? '#c4b5fd' : '#e8e9ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // No point burning battery painting a sky nobody is looking at.
    const onVisibility = () => (document.hidden ? stop() : start());

    layout();
    start();
    window.addEventListener('resize', layout);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      window.removeEventListener('resize', layout);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Static aurora ground — this is also the entire background when motion is reduced. */}
      <div className="absolute inset-0 bg-void" />
      <div className="aurora-a absolute -top-1/3 -left-1/4 h-[80vmax] w-[80vmax] rounded-full opacity-45 blur-[80px] [background:radial-gradient(circle,#7c3aed_0%,transparent_62%)]" />
      <div className="aurora-b absolute -right-1/4 -bottom-1/3 h-[70vmax] w-[70vmax] rounded-full opacity-35 blur-[90px] [background:radial-gradient(circle,#22d3ee_0%,transparent_62%)]" />
      <div className="absolute top-1/4 right-1/3 h-[45vmax] w-[45vmax] rounded-full opacity-20 blur-[100px] [background:radial-gradient(circle,#fb7185_0%,transparent_65%)]" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      {/* Vignette keeps text legible wherever the aurora happens to be bright. */}
      <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_35%,#05060f_95%)]" />
    </div>
  );
}
