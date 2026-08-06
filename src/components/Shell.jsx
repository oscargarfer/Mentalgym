import {
  LayoutDashboard, Zap, Layers, Eye, Settings2, BookOpen, Activity, CalendarClock, Hash, Landmark,
} from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { cx, Kbd } from './ui.jsx'

export const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, key: '1', desc: 'Métricas y evolución' },
  { id: 'warmup', label: 'Calentamiento', icon: Zap, key: '2', desc: 'Asociación flash' },
  { id: 'massive', label: 'Memorización', icon: Layers, key: '3', desc: 'Bloque masivo + VRN' },
  { id: 'review', label: 'Repaso', icon: CalendarClock, key: '4', desc: 'Retentiva a largo plazo' },
  { id: 'rsvp', label: 'Taquistoscopio', icon: Eye, key: '5', desc: 'RSVP 300-900 PPM' },
  { id: 'numbers', label: 'Números', icon: Hash, key: '6', desc: 'Casillero, binario y baraja' },
  { id: 'palace', label: 'Palacio', icon: Landmark, key: '7', desc: 'Memoria ordenada' },
  { id: 'method', label: 'Método', icon: BookOpen, key: '8', desc: 'Protocolo y atajos' },
  { id: 'settings', label: 'Ajustes', icon: Settings2, key: '9', desc: 'Idioma y datos' },
]

export default function Shell({ view, setView, children }) {
  const { deck, locked, sessions, resumenRepaso } = useApp()

  return (
    <div className="flex h-full w-full overflow-hidden bg-ink-950">
      {/* ---------- Barra lateral ---------- */}
      <aside className="flex w-[68px] shrink-0 flex-col items-center gap-1 border-r border-line-soft bg-ink-900/50 py-4 lg:w-[228px] lg:items-stretch lg:px-3">
        <div className="mb-6 flex items-center gap-2.5 px-1 lg:px-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cy/40 bg-cy/8">
            <Activity size={17} className="text-cy" />
          </div>
          <div className="hidden leading-tight lg:block">
            <div className="font-mono text-[11px] font-bold tracking-[0.18em] text-slate-200">
              GIMNASIO
            </div>
            <div className="font-mono text-[9px] tracking-[0.16em] text-mute">MENTAL · v1.0</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = view === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => !locked && setView(item.id)}
                title={`${item.label} (${item.key})`}
                className={cx(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
                  active
                    ? 'bg-cy/10 text-cy'
                    : 'text-mute hover:bg-white/4 hover:text-slate-300',
                  locked && !active && 'opacity-25',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-full bg-cy shadow-[0_0_10px_#00e5ff]" />
                )}
                <item.icon size={17} className="shrink-0" />
                <span className="hidden flex-1 text-left text-[13px] font-medium lg:block">
                  {item.label}
                </span>
                {/* Repasos vencidos: avisa, nunca bloquea */}
                {item.id === 'review' && resumenRepaso.pendientes > 0 && (
                  <span
                    title={`${resumenRepaso.pendientes} palabras esperando repaso`}
                    className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-am/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-am ring-1 ring-am/40"
                  >
                    {resumenRepaso.pendientes > 99 ? '99+' : resumenRepaso.pendientes}
                  </span>
                )}
                <Kbd tone={active ? 'cy' : 'mute'} className="hidden lg:inline-flex">
                  {item.key}
                </Kbd>
              </button>
            )
          })}
        </nav>

        <div className="hidden rounded-xl border border-line-soft p-3 lg:block">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-mute">
            Idioma objetivo
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: deck.accent, boxShadow: `0 0 8px ${deck.accent}` }}
            />
            <span className="truncate text-[13px] font-medium text-slate-300">{deck.name}</span>
          </div>
          <div className="mt-1 font-mono text-[10px] text-mute">
            {deck.count.toLocaleString('es-ES')} palabras · {sessions.length} sesiones
          </div>
        </div>
      </aside>

      {/* ---------- Contenido ---------- */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
        <div className="pointer-events-none absolute inset-0 vignette" />
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </main>
    </div>
  )
}
