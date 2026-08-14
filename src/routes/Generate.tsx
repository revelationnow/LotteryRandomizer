import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '../router';
import { useStore } from '../store';
import { GAMES } from '../lib/games';
import { useGameData } from '../lib/useGameData';
import { useIsDesktop } from '../lib/useMediaQuery';
import { generateTickets, validate, type Ticket } from '../lib/constraints';
import { sliderToBeta } from '../lib/weights';
import { newSeed } from '../lib/rng';
import { Orb } from '../components/Orb';
import { LuckPanel } from '../components/LuckPanel';
import { BottomSheet } from '../components/BottomSheet';
import { Button, Panel } from '../components/ui';
import { ShareButton } from '../components/ShareCard';
import { DataBadge } from '../components/DataBadge';

export function Generate() {
  const gameId = useStore((s) => s.game);
  const controls = useStore((s) => s.controls);
  const tickets = useStore((s) => s.tickets);
  const setTickets = useStore((s) => s.setTickets);
  const save = useStore((s) => s.save);
  const { data, error, loading } = useGameData(gameId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const [problem, setProblem] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const game = GAMES[gameId];

  const input = useMemo(() => {
    if (!data) return null;
    return {
      game,
      whiteStats: data.white,
      specialStats: data.special,
      options: {
        beta: sliderToBeta(controls.bias),
        pinned: controls.pinned,
        excluded: controls.excluded,
        pinnedSpecial: controls.pinnedSpecial,
        oddCount: controls.oddCount,
        sumRange: controls.sumRange,
      },
      seed: controls.seed,
    };
  }, [data, game, controls]);

  const configError = input ? validate(input) : null;

  const draw = useCallback(() => {
    if (!input || configError) return;
    setProblem(null);
    setSpinning(true);
    try {
      setTickets(generateTickets(input, controls.ticketCount));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    }
    // Matches the orb reveal so the button settles when the numbers do.
    window.setTimeout(() => setSpinning(false), 700);
  }, [input, configError, controls.ticketCount, setTickets]);

  // Clear stale results whenever the configuration becomes invalid.
  useEffect(() => {
    if (configError) setTickets([]);
  }, [configError, setTickets]);

  if (error) {
    return (
      <Panel title="Could not load draw history">
        <p className="text-sm text-muted">{error}</p>
        <p className="mt-2 text-sm text-muted">
          Run <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">npm run ingest</code>{' '}
          to fetch the official results, or{' '}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">npm run fixture</code>{' '}
          for offline sample data.
        </p>
      </Panel>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_22rem] md:items-start">
      <div className="space-y-5">
        <div className="text-center md:text-left">
          <h1 className="font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {game.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pick {game.whiteCount} from 1–{game.eras[0].whiteMax}, plus a {game.specialName} from 1–
            {game.eras[0].specialMax}. Drawn {game.drawDays}.
          </p>
        </div>

        <DataBadge gameId={gameId} />

        <div className="glass relative overflow-hidden rounded-3xl px-4 py-8 sm:px-8 sm:py-10">
          {/* aria-live so a screen reader announces the numbers when they land. */}
          <div aria-live="polite" aria-atomic="true" className="space-y-8">
            {tickets.length > 0 ? (
              // Keying on the drawn numbers remounts the subtree each draw, which
              // restarts the CSS fade and the orbs' staggered entrance.
              <div
                key={tickets.map((t) => `${t.white.join('-')}${t.special}`).join('|')}
                className="fade-in space-y-8"
              >
                {tickets.map((ticket, i) => (
                    <TicketRow
                      key={i}
                      ticket={ticket}
                      index={i}
                      gameId={gameId}
                      onSave={() =>
                        save({
                          ...ticket,
                          id: `${Date.now()}-${i}`,
                          game: gameId,
                          savedAt: new Date().toISOString(),
                          label: `${game.shortName} · ${new Date().toLocaleDateString()}`,
                          seed: controls.seed,
                          bias: controls.bias,
                        })
                      }
                    />
                ))}
              </div>
            ) : (
              <EmptyStage count={game.whiteCount} />
            )}
          </div>
        </div>

        {(problem || configError) && (
          <p role="alert" className="rounded-xl border border-rose/30 bg-rose/10 px-4 py-3 text-sm text-rose">
            {configError ?? problem}
          </p>
        )}

        {tickets.some((t) => t.relaxed) && (
          <p role="status" className="rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber">
            No combination could satisfy your odd/even and sum settings, so those were relaxed for
            this draw. Widen the range and try again.
          </p>
        )}

        {/* Sticky on mobile so the primary action is always in reach of a thumb.
            The blurred ground means content scrolling underneath reads as passing
            behind a bar rather than colliding with a floating button. */}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex gap-3 border-t border-white/8 bg-void/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <Button
            variant="primary"
            onClick={draw}
            disabled={loading || !!configError}
            className="min-h-14 flex-1 text-base"
          >
            {spinning ? 'Drawing…' : tickets.length ? 'Draw again' : 'Draw numbers'}
          </Button>
          <Button
            onClick={() => setSheetOpen(true)}
            className="min-h-14 px-5 md:hidden"
            aria-label="Tune your luck"
          >
            <SlidersIcon />
            <span className="sr-only sm:not-sr-only">Tune</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-faint md:justify-start">
          <span>Seeded by your device's cryptographic random source.</span>
          {controls.seed && (
            <span className="font-mono tracking-widest text-muted">seed {controls.seed}</span>
          )}
          {!controls.seed && tickets.length > 0 && data && (
            <button
              // Inline within a sentence, so WCAG 2.5.8's minimum target size
              // does not apply; the verification script skips it by this flag.
              data-inline-target
              className="underline underline-offset-2 hover:text-ink"
              onClick={() => useStore.getState().patch({ seed: newSeed() })}
            >
              Lock a seed to reproduce these
            </button>
          )}
        </div>

        {data && <FairnessNote pValue={data.whiteChi.pValue} draws={data.white.draws} />}
      </div>

      {/* Desktop sidebar; the same controls appear in a sheet on mobile. Gated on
          the media query rather than a `hidden md:block` class so a phone never
          builds this subtree at all. */}
      {isDesktop && (
        <aside>
          <Panel title="Tune your luck" className="sticky top-24">
            <LuckPanel gameId={gameId} />
          </Panel>
        </aside>
      )}

      {!isDesktop && (
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Tune your luck">
          <LuckPanel gameId={gameId} />
          <Button
            variant="primary"
            className="mt-6 min-h-14 w-full"
            onClick={() => setSheetOpen(false)}
          >
            Done
          </Button>
        </BottomSheet>
      )}
    </div>
  );
}

/**
 * The honest footnote, carrying the live chi-square result rather than a canned
 * disclaimer. Weighting is the feature the user asked for; this is the app being
 * straight about what the weighting can and cannot do.
 */
function FairnessNote({ pValue, draws }: { pValue: number; draws: number }) {
  return (
    <Link
      to="/observatory"
      className="glass block rounded-2xl p-4 transition hover:bg-white/8"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cyan/15 text-cyan"
        >
          ✓
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">This machine looks perfectly fair</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Across {draws.toLocaleString()} draws, a chi-square test returns p ={' '}
            <span className="tabular">{pValue < 0.001 ? '<0.001' : pValue.toFixed(2)}</span> — the
            hot and cold numbers are noise, not a pattern. Bias the draw for fun; it will not change
            your odds.{' '}
            <span className="whitespace-nowrap text-cyan underline underline-offset-2">
              See the numbers →
            </span>
          </p>
        </div>
      </div>
    </Link>
  );
}

function TicketRow({
  ticket,
  index,
  gameId,
  onSave,
}: {
  ticket: Ticket;
  index: number;
  gameId: 'powerball' | 'megamillions';
  onSave: () => void;
}) {
  const game = GAMES[gameId];
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-4">
      {/* A five-column grid rather than a wrapping flex row: the main numbers stay
          on one line at every width, with the special ball on its own below. */}
      <div className="mx-auto w-full max-w-md">
        <ul className="grid grid-cols-5 gap-2 sm:gap-3">
          {ticket.white.map((n, i) => (
            <li key={`${n}-${i}`}>
              <Orb value={n} size="fill" index={index * 6 + i} label={`Number ${n}`} />
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col items-center gap-1.5">
          <div className="w-[calc((100%-2rem)/5)] min-w-14">
            <Orb
              value={ticket.special}
              size="fill"
              tone="special"
              accent={game.accent}
              index={index * 6 + game.whiteCount}
              label={`${game.specialName} ${ticket.special}`}
            />
          </div>
          <span className="text-[11px] font-medium tracking-wide text-faint uppercase">
            {game.specialName}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          onClick={() => {
            onSave();
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1800);
          }}
          className="text-sm"
        >
          {saved ? 'Saved ✓' : 'Save to vault'}
        </Button>
        <ShareButton ticket={ticket} gameId={gameId} />
      </div>
    </div>
  );
}

function EmptyStage({ count }: { count: number }) {
  return (
    <div className="fade-in flex flex-col items-center gap-5 py-4 text-center">
      <div aria-hidden className="mx-auto w-full max-w-md">
        <ul className="grid grid-cols-5 gap-2 sm:gap-3">
          {Array.from({ length: count }, (_, i) => (
            <li
              key={i}
              className="aspect-square w-full rounded-full border border-dashed border-white/15 bg-white/3"
            />
          ))}
        </ul>
        <div className="mt-4 flex justify-center">
          <div className="aspect-square w-[calc((100%-2rem)/5)] min-w-14 rounded-full border border-dashed border-white/15 bg-white/3" />
        </div>
      </div>
      <p className="max-w-sm text-sm text-balance text-muted">
        Your numbers will appear here. Tune the bias first, or just draw a perfectly fair set.
      </p>
    </div>
  );
}

function SlidersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="10" cy="17" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
