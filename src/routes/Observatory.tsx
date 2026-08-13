import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { GAMES } from '../lib/games';
import { useGameData } from '../lib/useGameData';
import { rankBalls, type ChiSquareResult, type PoolStats } from '../lib/stats';
import { Panel, Stat } from '../components/ui';
import { DataBadge } from '../components/DataBadge';

type Pool = 'white' | 'special';

export function Observatory() {
  const gameId = useStore((s) => s.game);
  const { data, error } = useGameData(gameId);
  const [pool, setPool] = useState<Pool>('white');
  const game = GAMES[gameId];

  if (error) return <Panel title="Could not load draw history">{error}</Panel>;
  if (!data) return <Panel title="Reading the sky…">Loading draw history.</Panel>;

  const stats = pool === 'white' ? data.white : data.special;
  const chi = pool === 'white' ? data.whiteChi : data.specialChi;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Observatory</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Everything the generator knows about {game.name}, laid out honestly.
        </p>
      </div>

      <DataBadge gameId={gameId} />

      <div role="tablist" aria-label="Pool" className="glass inline-flex rounded-full p-1 text-sm">
        {(['white', 'special'] as Pool[]).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={pool === p}
            onClick={() => setPool(p)}
            className={`min-h-11 rounded-full px-4 font-medium transition ${
              pool === p ? 'bg-white/15 text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {p === 'white' ? `Main numbers 1–${game.eras[0].whiteMax}` : game.specialName}
          </button>
        ))}
      </div>

      <VerdictCard chi={chi} stats={stats} />

      <Panel
        title="Frequency map"
        subtitle="Brightness is how far each number sits from its expected count. Hot numbers glow."
      >
        <HeatGrid stats={stats} />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Leaderboard title="Drawn most" stats={stats} order="hot" />
        <Leaderboard title="Drawn least" stats={stats} order="cold" />
      </div>

      <Panel
        title="Longest droughts"
        subtitle="Draws since each number last appeared. A long gap is normal, not a signal."
      >
        <Leaderboard stats={stats} order="drought" bare />
      </Panel>
    </div>
  );
}

/**
 * The chi-square verdict — the point of the whole screen.
 *
 * On real data this essentially always comes back "consistent with a fair machine",
 * which is exactly the honest thing for the app to say.
 */
function VerdictCard({ chi, stats }: { chi: ChiSquareResult; stats: PoolStats }) {
  const spread = useMemo(() => {
    if (stats.expected <= 0) return null;
    const ranked = rankBalls(stats);
    if (!ranked.length) return null;
    const sorted = [...ranked].sort((a, b) => b.count - a.count);
    return { hottest: sorted[0], coldest: sorted[sorted.length - 1] };
  }, [stats]);

  return (
    <Panel
      className={
        chi.uniform ? 'border-cyan/25 bg-cyan/6' : 'border-amber/30 bg-amber/8'
      }
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden>{chi.uniform ? '✓' : '!'}</span>
          {chi.uniform ? 'Indistinguishable from a fair draw' : 'Deviation worth a second look'}
        </span>
      }
    >
      <p className="text-sm leading-relaxed text-muted">
        {chi.uniform ? (
          <>
            A chi-square test across all {stats.size} numbers finds no meaningful departure from
            uniform. The gap between the most and least drawn number is ordinary sampling noise —
            not a pattern. Turning the bias up amplifies that noise; it does not find a signal,
            because there isn't one to find.
          </>
        ) : (
          <>
            This pool shows more variation than chance alone comfortably explains (p &lt; 0.05). With{' '}
            {stats.size} numbers tested at once, a result this extreme still turns up by luck
            roughly one time in twenty, so it is not evidence of a biased machine.
          </>
        )}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Chi-square" value={chi.chi2.toFixed(1)} hint={`${chi.df} degrees of freedom`} />
        <Stat
          label="p-value"
          value={chi.pValue < 0.001 ? '<0.001' : chi.pValue.toFixed(3)}
          hint={chi.uniform ? 'fair' : 'unusual'}
        />
        <Stat label="Draws" value={stats.draws.toLocaleString()} hint="in the current matrix" />
        <Stat
          label="Expected each"
          value={stats.expected.toFixed(1)}
          hint={
            spread
              ? `actual ${spread.coldest.count}–${spread.hottest.count}`
              : undefined
          }
        />
      </div>
    </Panel>
  );
}

/**
 * Frequency heat map.
 *
 * Diverging cool-to-warm scale centred on the expected count, so "average" is
 * visibly neutral. Colour is never the only channel — every cell shows its number
 * and exposes its exact count to assistive technology.
 */
function HeatGrid({ stats }: { stats: PoolStats }) {
  const ranked = rankBalls(stats);
  const deviations = ranked.map((r) => r.count - stats.expected);
  const scale = Math.max(1, ...deviations.map(Math.abs));

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
        {ranked.map((r) => {
          const t = (r.count - stats.expected) / scale; // -1 (cold) .. +1 (hot)
          const hue = t >= 0 ? 38 : 196;
          const intensity = Math.abs(t);
          return (
            <div
              key={r.ball}
              title={`${r.ball}: drawn ${r.count} times (expected ${stats.expected.toFixed(1)})`}
              aria-label={`Number ${r.ball}, drawn ${r.count} times, expected ${stats.expected.toFixed(1)}`}
              className="grid aspect-square min-h-11 place-items-center rounded-lg border border-white/8 text-sm font-semibold tabular"
              style={{
                background: `oklch(${0.28 + intensity * 0.42} ${0.02 + intensity * 0.15} ${hue})`,
                color: intensity > 0.55 && t > 0 ? '#05060f' : '#f4f4ff',
                boxShadow: intensity > 0.6 ? `0 0 14px oklch(0.7 0.16 ${hue} / 0.4)` : undefined,
              }}
            >
              {r.ball}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-3 text-[11px] text-faint">
        <span>Cold</span>
        <div
          aria-hidden
          className="h-2 flex-1 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, oklch(0.7 0.17 196), oklch(0.3 0.02 196), oklch(0.3 0.02 38), oklch(0.7 0.17 38))',
          }}
        />
        <span>Hot</span>
      </div>
    </>
  );
}

function Leaderboard({
  title,
  stats,
  order,
  bare,
}: {
  title?: string;
  stats: PoolStats;
  order: 'hot' | 'cold' | 'drought';
  bare?: boolean;
}) {
  const rows = useMemo(() => {
    const ranked = rankBalls(stats);
    if (order === 'drought') return ranked.sort((a, b) => b.drought - a.drought).slice(0, 8);
    ranked.sort((a, b) => (order === 'hot' ? b.count - a.count : a.count - b.count));
    return ranked.slice(0, 8);
  }, [stats, order]);

  const list = (
    <ol className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.ball} className="flex items-center gap-3 text-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 font-semibold tabular">
            {r.ball}
          </span>
          <span className="min-w-0 flex-1 text-muted">
            {order === 'drought' ? (
              <>
                <span className="tabular text-ink">{r.drought}</span> draws ago
              </>
            ) : (
              <>
                <span className="tabular text-ink">{r.count}</span> times
                <span className="text-faint"> · {(r.ratio * 100).toFixed(0)}% of expected</span>
              </>
            )}
          </span>
          {order !== 'drought' && (
            <span
              aria-hidden
              className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/8 sm:w-24"
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.min(100, r.ratio * 55)}%`,
                  background: order === 'hot' ? '#fbbf24' : '#22d3ee',
                }}
              />
            </span>
          )}
        </li>
      ))}
    </ol>
  );

  if (bare) return list;
  return (
    <Panel title={title} subtitle="Over the eligible draws">
      {list}
    </Panel>
  );
}
