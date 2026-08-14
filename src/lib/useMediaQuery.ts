import { useEffect, useState } from 'react';

/**
 * Track a media query.
 *
 * Used to actually skip rendering the desktop-only controls on a phone. Hiding
 * them with a CSS class still builds the whole subtree — for the luck panel that
 * is seventy-odd buttons constructed on every render, on the device least able to
 * afford it.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Matches the `md` breakpoint, where the layout gains its sidebar. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}
