import { useEffect } from 'react'
import { useApp } from '../state/AppContext.jsx'
import { useEvitarSuspension } from '../lib/tactil.js'
import { cx } from './ui.jsx'

/**
 * Las cuatro capacidades que se entrenan. Cada módulo declara cuál trabaja, y
 * ese es el marco de toda la aplicación: no se entrenan seis ejercicios sueltos,
 * se entrenan cuatro facultades por cuatro caminos distintos.
 *
 * El color nunca va solo: siempre lleva el nombre de la capacidad al lado. El
 * par asociar/ordenar queda cerca para visión deutan, y esa es la condición para
 * que la paleta sea legítima.
 */
export const CAPACIDADES = {
  aso: { nombre: 'Asociar', color: 'aso', que: 'convertir lo abstracto en imagen' },
  ord: { nombre: 'Ordenar', color: 'ord', que: 'evocar en secuencia' },
  ret: { nombre: 'Retener', color: 'ret', que: 'que sobreviva al tiempo' },
  pro: { nombre: 'Procesar', color: 'pro', que: 'reconocer más rápido' },
}

export const NAV = [
  { id: 'dashboard', label: 'Registro', key: '1', grupo: 'seguimiento', desc: 'Capacidad y evolución' },
  { id: 'warmup', label: 'Calentamiento', key: '2', cap: 'aso', desc: 'Asociación flash' },
  { id: 'massive', label: 'Memorización', key: '3', cap: 'aso', desc: 'Bloque masivo a contrarreloj' },
  { id: 'numbers', label: 'Números', key: '6', cap: 'aso', desc: 'Casillero, binario y baraja' },
  { id: 'palace', label: 'Palacio', key: '7', cap: 'ord', desc: 'Recorrido y evocación ordenada' },
  { id: 'review', label: 'Repaso', key: '4', cap: 'ret', desc: 'Retentiva a largo plazo' },
  { id: 'rsvp', label: 'Taquistoscopio', key: '5', cap: 'pro', desc: 'Reconocimiento visual' },
  { id: 'method', label: 'Método', key: '8', grupo: 'preparar', desc: 'Cómo se entrena' },
  { id: 'settings', label: 'Ajustes', key: '9', grupo: 'preparar', desc: 'Material y datos' },
]

const TINTA = { aso: 'bg-aso', ord: 'bg-ord', ret: 'bg-ret', pro: 'bg-pro' }

function Seccion({ children }) {
  return <div className="rotulo px-4 pb-1.5 pt-5 lg:px-5">{children}</div>
}

export default function Shell({ view, setView, children }) {
  const { deck, locked, sessions, resumenRepaso, settings } = useApp()

  // `locked` ya lo activan los seis módulos mientras se entrena, así que sirve
  // tal cual para no dejar que la pantalla se apague en mitad de una carga.
  useEvitarSuspension(locked)

  // El modo táctil se puede forzar desde Ajustes para probarlo con ratón.
  useEffect(() => {
    document.documentElement.dataset.tactil = settings.tactil || 'auto'
  }, [settings.tactil])

  const entrenar = NAV.filter((n) => n.cap)
  const seguimiento = NAV.filter((n) => n.grupo === 'seguimiento')
  const preparar = NAV.filter((n) => n.grupo === 'preparar')

  const Boton = (item, n) => {
    const activo = view === item.id
    const cap = item.cap ? CAPACIDADES[item.cap] : null
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => !locked && setView(item.id)}
        title={`${item.label} · ${item.desc} (${item.key})`}
        className={cx(
          'group relative flex w-full items-baseline gap-2.5 border-l-2 px-4 py-2 text-left transition-colors lg:px-5',
          activo
            ? 'border-ink bg-surface font-semibold text-ink'
            : 'border-transparent text-ink-2 hover:bg-surface-2',
          locked && !activo && 'opacity-30',
        )}
      >
        <span className="num w-5 shrink-0 text-[11px] text-ink-3">
          {String(n).padStart(2, '0')}
        </span>
        <span className="hidden min-w-0 flex-1 lg:block">
          <span className="block truncate text-[13.5px] leading-tight">{item.label}</span>
          {cap && (
            <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-ink-3">
              <i className={cx('inline-block h-[7px] w-[7px] shrink-0', TINTA[cap.color])} />
              {cap.nombre}
            </span>
          )}
        </span>
        {/* Repasos vencidos: avisa, nunca bloquea */}
        {item.id === 'review' && resumenRepaso.pendientes > 0 && (
          <span
            title={`${resumenRepaso.pendientes} fichas esperando repaso`}
            className="num shrink-0 border border-ret px-1.5 text-[10.5px] font-bold leading-[17px] text-ret"
          >
            {resumenRepaso.pendientes > 99 ? '99+' : resumenRepaso.pendientes}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface">
      {/* ---------- Barra lateral ---------- */}
      <aside className="flex w-[62px] shrink-0 flex-col border-r border-rule bg-paper lg:w-[232px]">
        <div className="border-b border-rule px-4 py-4 lg:px-5">
          <div className="hidden lg:block">
            <div className="font-serif text-[19px] font-semibold leading-none tracking-[-0.01em] text-ink">
              Gimnasio Mental
            </div>
            <div className="mt-1 text-[11px] text-ink-3">Cuaderno de entrenamiento</div>
          </div>
          <div className="font-serif text-[19px] font-semibold text-ink lg:hidden">GM</div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
          {seguimiento.map((it, i) => Boton(it, i + 1))}
          <Seccion>Entrenar</Seccion>
          {entrenar.map((it, i) => Boton(it, i + 2))}
          <Seccion>Preparar</Seccion>
          {preparar.map((it, i) => Boton(it, i + entrenar.length + 2))}
        </nav>

        <div className="hidden border-t border-rule px-5 py-3.5 lg:block">
          <div className="rotulo">Material</div>
          <div className="mt-1 truncate text-[13px] text-ink-2">{deck.name}</div>
          <div className="num mt-0.5 text-[11px] text-ink-3">
            {deck.count.toLocaleString('es-ES')} fichas · {sessions.length} sesiones
          </div>
        </div>
      </aside>

      {/* ---------- Contenido ---------- */}
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
