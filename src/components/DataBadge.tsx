import { useGameData } from '../lib/useGameData';
import { GAMES, type GameId } from '../lib/games';

/**
 * Provenance line: where the numbers come from, how many draws back them, and a
 * loud warning when the app is running on synthetic data.
 */
export function DataBadge({ gameId }: { gameId: GameId }) {
  const { data } = useGameData(gameId);
  if (!data) return null;

  const game = GAMES[gameId];
  const fixture = data.snapshot.source === 'fixture';

  if (fixture) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-xl border border-amber/40 bg-amber/12 px-4 py-3 text-xs leading-relaxed text-amber"
      >
        <span aria-hidden className="text-sm">
          ⚠
        </span>
        <span>
          <strong className="font-semibold">Sample data.</strong> These are synthetic draws, not real
          results. Run <code className="font-mono">npm run ingest</code> to load the official history
          from NY Open Data.
        </span>
      </div>
    );
  }

  return (
    <p className="text-xs leading-relaxed text-faint">
      Weighted by{' '}
      <strong className="font-semibold text-muted tabular">{data.white.draws.toLocaleString()}</strong>{' '}
      draws since {formatDate(game.whiteWeightingFrom)} — every draw under the current{' '}
      {game.eras[0].whiteMax}-number matrix.{' '}
      {data.special.draws !== data.white.draws && (
        <>
          The {game.specialName} uses{' '}
          <strong className="font-semibold text-muted tabular">
            {data.special.draws.toLocaleString()}
          </strong>{' '}
          of those, excluding draws whose {game.specialName} has since been retired.{' '}
        </>
      )}
      Latest result {data.latestDraw ? formatDate(data.latestDraw) : 'unknown'}.
    </p>
  );
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
