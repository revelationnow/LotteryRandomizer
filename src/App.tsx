import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Starfield } from './components/Starfield';
import { Logo } from './components/Logo';
import { Generate } from './routes/Generate';
import { Observatory } from './routes/Observatory';
import { Vault } from './routes/Vault';
import { useStore } from './store';
import { GAMES, GAME_IDS } from './lib/games';

const TABS = [
  { to: '/generate', label: 'Generate', icon: SparkIcon },
  { to: '/observatory', label: 'Observatory', icon: ChartIcon },
  { to: '/vault', label: 'Vault', icon: VaultIcon },
];

export function App() {
  return (
    <>
      <Starfield />
      {/* 100dvh, not 100vh: the mobile URL bar collapses and vh would overflow. */}
      <div className="safe-x relative flex min-h-[100dvh] flex-col">
        <Header />
        {/* The disclaimer lives inside main so a single pb-navbar keeps every last
            element clear of the fixed mobile tab bar. */}
        <main className="pb-navbar mx-auto w-full max-w-5xl flex-1 px-4 pt-4 sm:px-6 md:pb-16">
          <Routes>
            <Route path="/generate" element={<Generate />} />
            <Route path="/observatory" element={<Observatory />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="*" element={<Navigate to="/generate" replace />} />
          </Routes>
          <Disclaimer />
        </main>
        <TabBar />
      </div>
    </>
  );
}

function Header() {
  const game = useStore((s) => s.game);
  const setGame = useStore((s) => s.setGame);

  return (
    <header className="safe-top sticky top-0 z-30 border-b border-white/5 bg-void/60 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
        <NavLink to="/generate" className="flex min-h-11 shrink-0 items-center gap-2">
          <Logo />
          <span className="font-display text-lg font-bold tracking-tight">Orrery</span>
        </NavLink>

        {/* Desktop tabs; on mobile these live in the bottom bar instead. */}
        <nav className="ml-4 hidden gap-1 md:flex">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition ${
                  isActive ? 'bg-white/12 text-ink' : 'text-muted hover:bg-white/6 hover:text-ink'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto">
          <div
            role="tablist"
            aria-label="Choose a game"
            className="glass flex rounded-full p-1 text-xs font-semibold sm:text-sm"
          >
            {GAME_IDS.map((id) => {
              const active = game === id;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setGame(id)}
                  className={`min-h-11 min-w-11 rounded-full px-3 transition sm:px-4 ${
                    active ? 'text-void' : 'text-muted hover:text-ink'
                  }`}
                  style={
                    active
                      ? {
                          background: `linear-gradient(135deg, ${GAMES[id].accent.from}, ${GAMES[id].accent.to})`,
                        }
                      : undefined
                  }
                >
                  <span className="sm:hidden">{GAMES[id].shortName}</span>
                  <span className="hidden sm:inline">{GAMES[id].name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Fixed bottom tabs on mobile — the only comfortable place for a thumb. */
function TabBar() {
  return (
    <nav
      aria-label="Sections"
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-void/85 backdrop-blur-xl md:hidden"
    >
      <div className="flex">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition ${
                isActive ? 'text-cyan' : 'text-faint'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <t.icon active={isActive} />
                {t.label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function Disclaimer() {
  return (
    <p
      data-disclaimer
      className="mx-auto max-w-3xl px-2 pt-10 text-center text-xs leading-relaxed text-faint"
    >
      Orrery is for entertainment. Lottery draws are independent and uniformly random, so no
      weighting scheme — including this one — improves your odds. Play responsibly. If gambling
      stops being fun, call 1-800-GAMBLER.
    </p>
  );
}

function SparkIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.9 5.3L19 10.2l-5.1 1.9L12 17.4l-1.9-5.3L5 10.2l5.1-1.9L12 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'}
        fillOpacity={active ? 0.25 : 0}
      />
    </svg>
  );
}

function ChartIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="12" width="4" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.6" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.3 : 0} />
      <rect x="10" y="7" width="4" height="13" rx="1.2" stroke="currentColor" strokeWidth="1.6" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.3 : 0} />
      <rect x="16.5" y="4" width="4" height="16" rx="1.2" stroke="currentColor" strokeWidth="1.6" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.3 : 0} />
    </svg>
  );
}

function VaultIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.22 : 0} />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8.6V6.4M12 17.6v-2.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
