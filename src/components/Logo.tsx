/**
 * Inline rather than an <img src="icon.svg">: one fewer network request, and it
 * survives the single-file standalone build where there is no separate asset.
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <radialGradient id="orrery-void" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#1b1740" />
          <stop offset="100%" stopColor="#05060f" />
        </radialGradient>
        <radialGradient id="orrery-orb" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#5b21b6" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#orrery-void)" />
      <ellipse cx="256" cy="256" rx="186" ry="70" fill="none" stroke="#22d3ee" strokeOpacity=".45" strokeWidth="6" />
      <ellipse cx="256" cy="256" rx="186" ry="70" fill="none" stroke="#22d3ee" strokeOpacity=".2" strokeWidth="6" transform="rotate(58 256 256)" />
      <ellipse cx="256" cy="256" rx="186" ry="70" fill="none" stroke="#fb7185" strokeOpacity=".3" strokeWidth="6" transform="rotate(-58 256 256)" />
      <circle cx="256" cy="256" r="72" fill="url(#orrery-orb)" />
      <circle cx="232" cy="230" r="20" fill="#ffffff" fillOpacity=".55" />
      <circle cx="442" cy="256" r="17" fill="#22d3ee" />
      <circle cx="157" cy="139" r="13" fill="#fb7185" />
      <circle cx="352" cy="390" r="11" fill="#fbbf24" />
    </svg>
  );
}
