import type { CSSProperties } from 'react';

export type OrbSize = 'sm' | 'md' | 'lg' | 'fill';
export type OrbTone = 'white' | 'special';

const SIZES: Record<OrbSize, string> = {
  // 'fill' takes the width of its grid cell, so five orbs always sit on one row
  // however narrow the phone is, instead of wrapping into an uneven 4 + 1.
  fill: 'w-full aspect-square text-[clamp(1.1rem,5.6vw,2rem)]',
  lg: 'h-[clamp(3.25rem,17vw,5rem)] w-[clamp(3.25rem,17vw,5rem)] text-[clamp(1.25rem,6.5vw,2rem)]',
  md: 'h-[clamp(2.5rem,12vw,3.25rem)] w-[clamp(2.5rem,12vw,3.25rem)] text-[clamp(1rem,4.5vw,1.25rem)]',
  sm: 'h-9 w-9 text-sm',
};

interface Props {
  value: number;
  tone?: OrbTone;
  size?: OrbSize;
  /** Position in the reveal sequence; drives the animation stagger. */
  index?: number;
  accent?: { from: string; to: string; glow: string };
  label?: string;
}

/**
 * A single numbered ball, rendered as luminous glass.
 *
 * White balls are a pale violet-white; the special ball takes the game's accent
 * (Powerball red, Mega Ball gold). The entrance is a CSS keyframe — see .orb-in —
 * staggered by index through a custom property.
 */
export function Orb({ value, tone = 'white', size = 'lg', index = 0, accent, label }: Props) {
  const isSpecial = tone === 'special' && accent;

  const background = isSpecial
    ? `radial-gradient(circle at 34% 28%, #fff 0%, ${accent.from} 42%, ${accent.to} 100%)`
    : 'radial-gradient(circle at 34% 28%, #ffffff 0%, #ede9fe 38%, #a78bfa 100%)';

  const glow = isSpecial ? accent.glow : '167, 139, 250';

  return (
    <div
      className={`${SIZES[size]} orb-in relative grid shrink-0 place-items-center rounded-full font-display font-bold tabular text-void select-none`}
      style={
        {
          background,
          boxShadow: `0 0 28px rgba(${glow},0.5), 0 6px 20px rgba(0,0,0,0.55), inset 0 -6px 14px rgba(0,0,0,0.22), inset 0 4px 10px rgba(255,255,255,0.7)`,
          '--orb-delay': `${index * 90}ms`,
        } as CSSProperties
      }
      role="img"
      aria-label={label ?? `${isSpecial ? 'Special ball' : 'Number'} ${value}`}
    >
      {/* Specular highlight — sells the glass. */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-[12%] left-[18%] h-[26%] w-[34%] rounded-full bg-white/70 blur-[3px]"
      />
      <span className="relative">{value}</span>
    </div>
  );
}
