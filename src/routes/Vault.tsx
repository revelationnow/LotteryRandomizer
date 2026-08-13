import { useMemo } from 'react';
import { useStore, type SavedTicket } from '../store';
import { GAMES, type GameId } from '../lib/games';
import { useGameData } from '../lib/useGameData';
import { tupleToDraw, type Draw } from '../lib/data';
import { checkTicket } from '../lib/prize';
import { Button, Panel } from '../components/ui';
import { ShareButton } from '../components/ShareCard';
import { formatDate } from '../components/DataBadge';

export function Vault() {
  const vault = useStore((s) => s.vault);
  const gameId = useStore((s) => s.game);
  const { data } = useGameData(gameId);

  // Check saved tickets against the most recent official result for their game.
  const latest = useMemo<Draw | null>(() => {
    if (!data || data.snapshot.draws.length === 0) return null;
    const sorted = [...data.snapshot.draws].sort((a, b) => b[0] - a[0]);
    return tupleToDraw(sorted[0]);
  }, [data]);

  const isFixture = data?.snapshot.source === 'fixture';

  if (vault.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <Panel>
          <div className="py-10 text-center">
            <p className="text-sm text-muted">
              Nothing saved yet. Generate a set and tap <strong className="text-ink">Save to vault</strong>{' '}
              to keep it here.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  const forThisGame = vault.filter((t) => t.game === gameId);
  const others = vault.filter((t) => t.game !== gameId);

  return (
    <div className="space-y-6">
      <Header />

      {latest && (
        <Panel
          title={`Latest ${GAMES[gameId].name} result`}
          subtitle={
            isFixture
              ? 'Sample data — not a real result'
              : `Drawn ${formatDate(latest.date)}`
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            {latest.white.map((n) => (
              <span
                key={n}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/90 font-display font-bold text-void tabular"
              >
                {n}
              </span>
            ))}
            <span
              className="grid h-10 w-10 place-items-center rounded-full font-display font-bold text-void tabular"
              style={{
                background: `linear-gradient(135deg, ${GAMES[gameId].accent.from}, ${GAMES[gameId].accent.to})`,
              }}
            >
              {latest.special}
            </span>
          </div>
        </Panel>
      )}

      <div className="space-y-3">
        {forThisGame.map((t) => (
          <VaultRow key={t.id} ticket={t} latest={latest} />
        ))}
      </div>

      {others.length > 0 && (
        <>
          <h2 className="pt-2 font-display text-sm font-semibold tracking-wide text-faint uppercase">
            Other games
          </h2>
          <div className="space-y-3">
            {others.map((t) => (
              <VaultRow key={t.id} ticket={t} latest={null} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Vault</h1>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
        Saved sets, checked against the most recent official draw. Stored only on this device.
      </p>
    </div>
  );
}

function VaultRow({ ticket, latest }: { ticket: SavedTicket; latest: Draw | null }) {
  const remove = useStore((s) => s.remove);
  const rename = useStore((s) => s.rename);
  const game = GAMES[ticket.game as GameId];
  const result = latest ? checkTicket(ticket.game, ticket, latest) : null;
  const matched = new Set(result?.matchedWhite ?? []);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <input
          value={ticket.label}
          onChange={(e) => rename(ticket.id, e.target.value)}
          aria-label="Ticket name"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 font-display text-base font-semibold hover:border-white/12 focus:border-white/20"
        />
        <button
          onClick={() => remove(ticket.id)}
          aria-label={`Delete ${ticket.label}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-faint transition hover:bg-rose/15 hover:text-rose"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7M7 7l.8 11.1A2 2 0 0 0 9.8 20h4.4a2 2 0 0 0 2-1.9L17 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <ul className="mt-2 flex flex-wrap items-center gap-2 px-2">
        {ticket.white.map((n) => (
          <li
            key={n}
            className={`grid h-10 w-10 place-items-center rounded-full font-display font-bold tabular transition ${
              matched.has(n)
                ? 'bg-cyan text-void ring-2 ring-cyan/50 ring-offset-2 ring-offset-transparent'
                : 'bg-white/90 text-void'
            }`}
          >
            {n}
          </li>
        ))}
        <li
          className={`grid h-10 w-10 place-items-center rounded-full font-display font-bold text-void tabular ${
            result?.specialMatch ? 'ring-2 ring-cyan/60 ring-offset-2 ring-offset-transparent' : ''
          }`}
          style={{
            background: `linear-gradient(135deg, ${game.accent.from}, ${game.accent.to})`,
          }}
        >
          {ticket.special}
        </li>
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="text-xs text-faint">
          {ticket.bias === 0 ? 'Fair draw' : ticket.bias > 0 ? `Hot bias ${ticket.bias}` : `Cold bias ${-ticket.bias}`}
          {ticket.seed && <span className="font-mono"> · seed {ticket.seed}</span>}
        </div>
        <ShareButton ticket={ticket} gameId={ticket.game} seed={ticket.seed} bias={ticket.bias} />
      </div>

      {result && (
        <div
          className={`mt-3 rounded-xl px-3 py-2 text-sm ${
            result.won ? 'bg-cyan/15 text-cyan' : 'bg-white/5 text-muted'
          }`}
        >
          {result.won ? (
            <>
              <strong className="font-semibold">
                {result.whiteMatches} number{result.whiteMatches === 1 ? '' : 's'}
                {result.specialMatch ? ` + the ${game.specialName}` : ''}
              </strong>{' '}
              — typically {result.tier?.label}
              {ticket.game === 'megamillions' && result.tier?.prize !== null && (
                <span className="text-muted"> before the drawn multiplier</span>
              )}
            </>
          ) : (
            <>
              {result.whiteMatches} number{result.whiteMatches === 1 ? '' : 's'} matched
              {result.specialMatch ? ` and the ${game.specialName}` : ''} — no prize this time.
            </>
          )}
        </div>
      )}

      {!result && (
        <p className="mt-3 px-2 text-xs text-faint">
          Switch to {game.name} at the top to check this against the latest result.
        </p>
      )}
    </Panel>
  );
}

export { Button };
