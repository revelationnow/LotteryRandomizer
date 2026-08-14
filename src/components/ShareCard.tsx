import { useState } from 'react';
import { GAMES, type GameId } from '../lib/games';
import type { Ticket } from '../lib/constraints';
import { renderCard, shareCard } from '../lib/share';
import { useStore } from '../store';
import { Button } from './ui';

export function ShareButton({
  ticket,
  gameId,
  seed,
  bias,
}: {
  ticket: Ticket;
  gameId: GameId;
  seed?: string | null;
  bias?: number;
}) {
  const controls = useStore((s) => s.controls);
  const [state, setState] = useState<
    'idle' | 'working' | 'shared' | 'saved' | 'declined' | 'unavailable' | 'error'
  >('idle');
  const game = GAMES[gameId];

  const onClick = async () => {
    setState('working');
    try {
      const blob = await renderCard({
        game,
        ticket,
        seed: seed !== undefined ? seed : controls.seed,
        bias: bias !== undefined ? bias : controls.bias,
      });
      const result = await shareCard(
        blob,
        `orrery-${gameId}-${ticket.white.join('-')}.png`,
        `My ${game.name} numbers from Orrery`,
      );
      setState(
        result === 'shared'
          ? 'shared'
          : result === 'downloaded'
            ? 'saved'
            : result === 'declined'
              ? 'declined'
              : 'unavailable',
      );
    } catch {
      setState('error');
    }
    window.setTimeout(() => setState('idle'), 2600);
  };

  const labels = {
    idle: 'Share',
    working: 'Rendering…',
    shared: 'Shared ✓',
    saved: 'Image saved ✓',
    declined: 'Save cancelled',
    unavailable: 'Saving is blocked here',
    error: 'Could not share',
  } as const;

  return (
    <Button onClick={onClick} disabled={state === 'working'} className="text-sm">
      {state === 'idle' && <ShareIcon />}
      {labels[state]}
    </Button>
  );
}

function ShareIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15V3.5M12 3.5L8.2 7.3M12 3.5l3.8 3.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
