import { useState } from 'react';
import { useStore } from '../store';
import { GAMES, type GameId } from '../lib/games';
import { sumBounds } from '../lib/constraints';
import { effectiveWindow, sliderToHalfLife } from '../lib/weights';
import { useGameData } from '../lib/useGameData';
import { newSeed, normalizeSeed } from '../lib/rng';
import { Button, Chip } from './ui';

const BIAS_PRESETS = [
  { label: 'Cold', value: -70, hint: 'favour rarely drawn numbers' },
  { label: 'Fair', value: 0, hint: 'every number equally likely' },
  { label: 'Hot', value: 70, hint: 'favour frequently drawn numbers' },
];

export function LuckPanel({ gameId }: { gameId: GameId }) {
  const controls = useStore((s) => s.controls);
  const patch = useStore((s) => s.patch);
  const toggle = useStore((s) => s.toggle);
  const reset = useStore((s) => s.resetControls);
  const game = GAMES[gameId];
  const era = game.eras[0];
  const [bounds] = useState(() => sumBounds(era.whiteMax, game.whiteCount));

  return (
    <div className="space-y-6">
      <BiasControl />
      <RecencyControl gameId={gameId} />

      <Section
        label="Numbers"
        hint="Tap once to pin a number to every ticket, twice to bar it completely."
      >
        <NumberGrid
          max={era.whiteMax}
          pinned={controls.pinned}
          excluded={controls.excluded}
          onTap={(n) => {
            if (controls.pinned.includes(n)) {
              toggle('pinned', n);
              toggle('excluded', n);
            } else if (controls.excluded.includes(n)) {
              toggle('excluded', n);
            } else {
              toggle('pinned', n);
            }
          }}
        />
        <Legend />
      </Section>

      <Section label={`Odd / even split`} hint="How many of the five should be odd.">
        <div className="flex flex-wrap gap-2">
          <Chip active={controls.oddCount === null} onClick={() => patch({ oddCount: null })}>
            Any
          </Chip>
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Chip
              key={n}
              active={controls.oddCount === n}
              onClick={() => patch({ oddCount: controls.oddCount === n ? null : n })}
            >
              {n} odd
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        label="Sum range"
        hint={`The five numbers add up to between ${bounds[0]} and ${bounds[1]}.`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={controls.sumRange === null} onClick={() => patch({ sumRange: null })}>
            Any
          </Chip>
          <Chip
            active={controls.sumRange !== null}
            onClick={() =>
              patch({
                sumRange: controls.sumRange
                  ? null
                  : // The middle band is where the overwhelming majority of real
                    // draws land, so it is the useful default to offer.
                    [Math.round(bounds[1] * 0.28), Math.round(bounds[1] * 0.62)],
              })
            }
          >
            Typical band
          </Chip>
          {controls.sumRange && (
            <div className="flex w-full items-center gap-2 pt-1">
              <NumberInput
                label="Minimum sum"
                value={controls.sumRange[0]}
                min={bounds[0]}
                max={controls.sumRange[1]}
                onChange={(v) => patch({ sumRange: [v, controls.sumRange![1]] })}
              />
              <span className="text-faint">to</span>
              <NumberInput
                label="Maximum sum"
                value={controls.sumRange[1]}
                min={controls.sumRange[0]}
                max={bounds[1]}
                onChange={(v) => patch({ sumRange: [controls.sumRange![0], v] })}
              />
            </div>
          )}
        </div>
      </Section>

      <Section label="Tickets" hint="Generate a batch in one go.">
        <div className="flex flex-wrap gap-2">
          {[1, 3, 5, 10].map((n) => (
            <Chip key={n} active={controls.ticketCount === n} onClick={() => patch({ ticketCount: n })}>
              {n}
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        label="Seed"
        hint="Lock a seed to reproduce the exact same numbers — share cards carry it."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            value={controls.seed ?? ''}
            placeholder="Random each time"
            aria-label="Seed"
            onChange={(e) => patch({ seed: normalizeSeed(e.target.value) || null })}
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/12 bg-white/5 px-3 font-mono text-sm tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-faint"
          />
          <Button onClick={() => patch({ seed: newSeed() })}>New</Button>
          {controls.seed && (
            <Button variant="ghost" onClick={() => patch({ seed: null })}>
              Clear
            </Button>
          )}
        </div>
      </Section>

      <Button variant="ghost" onClick={reset} className="w-full">
        Reset everything
      </Button>
    </div>
  );
}

/**
 * The bias slider.
 *
 * A single control spanning cold -> fair -> hot. Step buttons flank it because
 * dragging a thin slider precisely is genuinely hard on a touchscreen.
 */
function BiasControl() {
  const bias = useStore((s) => s.controls.bias);
  const patch = useStore((s) => s.patch);
  const preset = BIAS_PRESETS.find((p) => p.value === bias);

  const describe =
    bias === 0
      ? 'Every number is exactly equally likely — a fair draw.'
      : bias > 0
        ? `Numbers drawn more often in the past are up to ${strength(bias)} more likely.`
        : `Numbers drawn less often in the past are up to ${strength(bias)} more likely.`;

  return (
    <Section label="Bias" hint={describe}>
      <div className="flex flex-wrap gap-2 pb-3">
        {BIAS_PRESETS.map((p) => (
          <Chip key={p.label} active={bias === p.value} onClick={() => patch({ bias: p.value })}>
            {p.label}
          </Chip>
        ))}
        {!preset && (
          <span className="self-center rounded-full bg-white/8 px-3 py-1 text-xs text-muted tabular">
            Custom {bias > 0 ? '+' : ''}
            {bias}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <StepButton label="Colder" onClick={() => patch({ bias: Math.max(-100, bias - 5) })}>
          −
        </StepButton>
        <div className="relative flex-1">
          <input
            type="range"
            min={-100}
            max={100}
            step={5}
            value={bias}
            aria-label="Bias towards cold or hot numbers"
            aria-valuetext={`${bias === 0 ? 'Fair' : bias > 0 ? `Hot ${bias}` : `Cold ${-bias}`}`}
            onChange={(e) => patch({ bias: Number(e.target.value) })}
            // pan-y keeps a vertical swipe scrolling the page rather than snagging
            // on the slider, which is the classic mobile slider annoyance.
            style={{ touchAction: 'pan-y' }}
            className="h-11 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,#22d3ee,#6f7192_50%,#fb7185)] [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-void [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-void [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(90deg,#22d3ee,#6f7192_50%,#fb7185)]"
          />
        </div>
        <StepButton label="Hotter" onClick={() => patch({ bias: Math.min(100, bias + 5) })}>
          +
        </StepButton>
      </div>
      <div className="flex justify-between px-1 text-[11px] text-faint">
        <span>Cold</span>
        <span>Fair</span>
        <span>Hot</span>
      </div>
    </Section>
  );
}

const RECENCY_PRESETS = [
  { label: 'All time', value: 0 },
  { label: 'Recent', value: 50 },
  { label: 'Right now', value: 100 },
];

/**
 * Recency decay.
 *
 * Pairs with the bias slider: bias sets how hard to lean on a number being hot,
 * recency sets how recent the evidence for that has to be. Alone it changes
 * nothing, because at bias 0 every weight is 1 regardless of the counts — the UI
 * says so rather than leaving the user to wonder why the slider does nothing.
 */
function RecencyControl({ gameId }: { gameId: GameId }) {
  const recency = useStore((s) => s.controls.recency);
  const bias = useStore((s) => s.controls.bias);
  const patch = useStore((s) => s.patch);
  const { data } = useGameData(gameId);

  const halfLife = sliderToHalfLife(recency);
  const window = effectiveWindow(halfLife);
  const available = data?.white.draws ?? 0;
  // Cannot weigh more draws than exist, however long the half-life.
  const effective = window == null ? available : Math.min(Math.round(window), available);
  const game = GAMES[gameId];
  const perDraw = game.whiteCount;
  // How many times each number comes up on average within the effective window.
  const perNumber = effective > 0 ? (effective * perDraw) / game.eras[0].whiteMax : 0;
  const thin = window != null && perNumber < 12;

  return (
    <Section
      label="Recency"
      hint={
        recency === 0
          ? 'Every draw in the current matrix counts the same, however old.'
          : `Recent draws count for more. A draw ${Math.round(halfLife!)} draws back counts half as much as the latest one.`
      }
    >
      <div className="flex flex-wrap gap-2 pb-3">
        {RECENCY_PRESETS.map((p) => (
          <Chip key={p.label} active={recency === p.value} onClick={() => patch({ recency: p.value })}>
            {p.label}
          </Chip>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <StepButton label="Longer memory" onClick={() => patch({ recency: Math.max(0, recency - 5) })}>
          −
        </StepButton>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={recency}
          aria-label="How much recent draws outweigh older ones"
          aria-valuetext={
            recency === 0 ? 'All draws count equally' : `Effectively the last ${effective} draws`
          }
          onChange={(e) => patch({ recency: Number(e.target.value) })}
          style={{ touchAction: 'pan-y' }}
          className="h-11 flex-1 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,#6f7192,#a78bfa)] [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-void [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-void [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-[linear-gradient(90deg,#6f7192,#a78bfa)]"
        />
        <StepButton label="Shorter memory" onClick={() => patch({ recency: Math.min(100, recency + 5) })}>
          +
        </StepButton>
      </div>

      <p className="pt-1 text-xs text-muted">
        Weighing{' '}
        <strong className="tabular text-ink">
          {effective.toLocaleString()}
        </strong>{' '}
        draws{recency > 0 ? ' worth of evidence' : ''} — about{' '}
        <strong className="tabular text-ink">{perNumber.toFixed(1)}</strong> appearances per number.
      </p>

      {thin && (
        <p className="mt-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-xs leading-relaxed text-amber">
          That is a thin sample. With this few appearances each, the gap between the hottest and
          coldest numbers is almost entirely luck — you are picking numbers that got lucky recently,
          which says nothing about the next draw.
        </p>
      )}

      {recency > 0 && bias === 0 && (
        <p className="mt-2 text-xs text-faint">
          Bias is set to Fair, so this has no effect yet — every number is equally likely regardless
          of how it is counted. Move the bias slider to use it.
        </p>
      )}
    </Section>
  );
}

/** Rough hottest-to-coldest odds ratio, for an honest description of the setting. */
function strength(bias: number): string {
  const ratio = Math.pow(1.1, (Math.abs(bias) / 100) * 8);
  return `${ratio.toFixed(1)}×`;
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/12 bg-white/5 text-lg text-muted transition hover:bg-white/10 hover:text-ink"
    >
      {children}
    </button>
  );
}

function NumberGrid({
  max,
  pinned,
  excluded,
  onTap,
}: {
  max: number;
  pinned: number[];
  excluded: number[];
  onTap: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
        const isPinned = pinned.includes(n);
        const isExcluded = excluded.includes(n);
        return (
          <button
            key={n}
            onClick={() => onTap(n)}
            aria-label={`${n}${isPinned ? ', pinned' : isExcluded ? ', excluded' : ''}`}
            aria-pressed={isPinned || isExcluded}
            className={`grid aspect-square min-h-11 place-items-center rounded-lg border text-sm font-medium tabular transition ${
              isPinned
                ? 'border-cyan bg-cyan/25 text-ink'
                : isExcluded
                  ? 'border-rose/40 bg-rose/12 text-rose/70 line-through'
                  : 'border-white/10 bg-white/4 text-muted hover:bg-white/10 hover:text-ink'
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 pt-2 text-[11px] text-faint">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-cyan bg-cyan/25" /> Pinned
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded border border-rose/40 bg-rose/12" /> Excluded
      </span>
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, Math.round(v))));
      }}
      className="min-h-11 w-24 rounded-xl border border-white/12 bg-white/5 px-3 text-sm tabular"
    />
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-display text-sm font-semibold tracking-wide uppercase">{label}</h3>
      {hint && <p className="mt-1 mb-3 text-xs leading-relaxed text-muted">{hint}</p>}
      {children}
    </div>
  );
}
