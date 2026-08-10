import { useEffect, useState } from 'react'
import { usePunteroGrueso, teclaDe, pulsar } from '../lib/tactil.js'

export const cx = (...c) => c.filter(Boolean).join(' ')

/**
 * Piezas compartidas del cuaderno de entrenamiento.
 *
 * Reglas del sistema, para que nada vuelva a parecer una plantilla:
 *  - Nada redondeado salvo lo que de verdad es una pastilla. Los filetes rectos
 *    son lo que hace que esto se lea como un instrumento y no como una tarjeta.
 *  - Las cifras van en serif y tabulares: se comparan entre sí y tienen que
 *    alinearse en columna.
 *  - El color es del dato, nunca del texto. Un texto coloreado grita; un filete
 *    de color al lado de un número informa.
 *  - Un solo acento por pantalla. La jerarquía la hacen tamaño y peso.
 */

/* ---------------- Tecla ---------------- */

const TINTA = {
  aso: 'text-aso',
  ord: 'text-ord',
  ret: 'text-ret',
  pro: 'text-pro',
  // Nombres heredados: siguen usándose en los módulos.
  cy: 'text-aso',
  gr: 'text-ord',
  vi: 'text-ret',
  rd: 'text-pro',
  am: 'text-warn',
  mute: 'text-ink-3',
}

const BORDE = {
  aso: 'border-aso',
  ord: 'border-ord',
  ret: 'border-ret',
  pro: 'border-pro',
  cy: 'border-aso',
  gr: 'border-ord',
  vi: 'border-ret',
  rd: 'border-pro',
  am: 'border-warn',
  mute: 'border-rule',
}

const FONDO = {
  aso: 'bg-aso',
  ord: 'bg-ord',
  ret: 'bg-ret',
  pro: 'bg-pro',
  cy: 'bg-aso',
  gr: 'bg-ord',
  vi: 'bg-ret',
  rd: 'bg-pro',
  am: 'bg-warn',
  mute: 'bg-ink-3',
}

export function Kbd({ children, tone = 'mute', className = '' }) {
  return (
    <kbd
      className={cx(
        'num inline-flex items-center justify-center border px-1.5 py-px text-[10.5px] font-semibold',
        tone === 'mute' ? 'border-rule text-ink-3' : cx(BORDE[tone], TINTA[tone]),
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/**
 * Atajo de teclado de la fase actual.
 *
 * Con teclado se lee; con el dedo se pulsa. Como cada módulo ya declara aquí lo
 * que hace cada tecla en cada fase, convertir esto en botón da los controles
 * táctiles de los seis ejercicios sin tocar la lógica de ninguno: el botón emite
 * la misma pulsación que el teclado (ver `lib/tactil.js`).
 */
export function KeyHint({ keys = [], label, tone = 'mute' }) {
  const tactil = usePunteroGrueso()
  const tecla = teclaDe(keys[0])

  if (tactil && tecla) {
    const principal = tone !== 'mute'
    return (
      <button
        type="button"
        // Sin esto, tocar el botón le quita el foco al campo de respuesta y el
        // teclado del móvil se cierra y se vuelve a abrir en cada pulsación.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pulsar(tecla)}
        className={cx(
          'inline-flex min-h-[46px] items-center justify-center border px-4 text-center text-[13px] leading-tight transition-colors active:opacity-70',
          principal
            ? 'grow border-ink bg-ink font-semibold text-paper'
            : 'max-w-[34%] grow-0 border-rule text-ink-2',
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
      {keys.map((k) => (
        <Kbd key={k} tone={tone}>
          {k}
        </Kbd>
      ))}
      <span>{label}</span>
    </span>
  )
}

/* ---------------- Contenedores ---------------- */

export function Panel({ children, className = '', accent = false }) {
  return (
    <div className={cx('panel p-5', accent && 'border-ink', className)}>{children}</div>
  )
}

export function SectionTitle({ icon: Icon, children, right }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-rule pb-2">
      <h2 className="rotulo flex items-center gap-2">
        {Icon && <Icon size={12} className="text-ink-3" />}
        {children}
      </h2>
      {right}
    </div>
  )
}

/* ---------------- Botones y selectores ---------------- */

export function Btn({ children, onClick, tone = 'cy', size = 'md', className = '', disabled, type = 'button' }) {
  // El botón principal es tinta sólida: en una pantalla clara, el peso lo da el
  // relleno, no un contorno de color. Los demás son contornos discretos.
  const principal = tone === 'cy' || tone === 'aso'
  const sizes = {
    sm: 'px-3 py-1.5 text-[12px]',
    md: 'px-4 py-2 text-[13px]',
    lg: 'px-6 py-3 text-[15px]',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'border font-semibold transition-colors',
        principal
          ? 'border-ink bg-ink text-paper hover:bg-ink-2'
          : cx('bg-transparent hover:bg-surface-2', BORDE[tone] || 'border-rule', TINTA[tone] || 'text-ink-2'),
        sizes[size],
        disabled && 'pointer-events-none opacity-30',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Choice({ options, value, onChange, className = '' }) {
  // Un grupo de opciones es un solo control: filetes compartidos, sin huecos.
  return (
    <div className={cx('inline-flex flex-wrap border border-rule', className)}>
      {options.map((o, i) => {
        const val = typeof o === 'object' ? o.value : o
        const label = typeof o === 'object' ? o.label : o
        const active = val === value
        return (
          <button
            key={String(val)}
            type="button"
            onClick={() => onChange(val)}
            className={cx(
              'px-3.5 py-2 text-[12.5px] font-medium transition-colors',
              i > 0 && 'border-l border-rule',
              active ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-surface-2',
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function NumberField({ value, onChange, min = 1, max = 999, suffix }) {
  return (
    <div className="inline-flex items-baseline gap-2 border border-rule px-3 py-1.5">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="num w-16 bg-transparent text-center text-[15px] font-semibold text-ink"
      />
      {suffix && <span className="rotulo">{suffix}</span>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 border border-rule px-4 py-3 text-left transition-colors hover:bg-surface-2"
    >
      <span className="text-[13.5px] text-ink-2">{label}</span>
      <span
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
          checked ? 'border-ink bg-ink' : 'border-rule bg-surface-2',
        )}
      >
        <span
          className={cx(
            'absolute top-[3px] h-3 w-3 rounded-full transition-all',
            checked ? 'left-[19px] bg-paper' : 'left-[3px] bg-ink-4',
          )}
        />
      </span>
    </button>
  )
}

/* ---------------- Métricas ---------------- */

export function Stat({ label, value, unit, tone = 'cy', sub, icon: Icon }) {
  // El color va en el filete de arriba, no en la cifra: así el número se lee
  // como número y el color solo dice de qué capacidad es.
  return (
    <div className="relative border border-rule bg-paper p-4">
      <span className={cx('absolute inset-x-0 top-0 h-[2px]', FONDO[tone] || 'bg-ink-3')} />
      <div className="flex items-start justify-between">
        <span className="rotulo">{label}</span>
        {Icon && <Icon size={13} className="text-ink-4" />}
      </div>
      <div className="mt-2.5 flex items-baseline gap-1">
        <span className="cifra text-[34px] leading-none text-ink">{value}</span>
        {unit && <span className="text-[12px] text-ink-3">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[11.5px] text-ink-3">{sub}</div>}
    </div>
  )
}

export function Progress({ value, max, tone = 'cy' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-[3px] w-full bg-rule">
      <div
        className={cx('h-full transition-[width] duration-200', FONDO[tone] || 'bg-ink')}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export function Badge({ children, tone = 'cy' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">
      <i className={cx('inline-block h-[7px] w-[7px] shrink-0', FONDO[tone] || 'bg-ink-3')} />
      {children}
    </span>
  )
}

/* ---------------- Cuenta atrás ---------------- */

export function Countdown({ from = 3, onDone, label = 'PREPARADO' }) {
  const [n, setN] = useState(from)

  useEffect(() => {
    if (n <= 0) {
      onDone?.()
      return undefined
    }
    const t = setTimeout(() => setN((v) => v - 1), 700)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <span className="rotulo">{label}</span>
      <div key={n} className="anim-pop cifra text-[96px] leading-none text-ink">
        {n}
      </div>
    </div>
  )
}

/* ---------------- Barra de estado inferior ---------------- */

/**
 * Pie de la pantalla del ejercicio. Con teclado es una leyenda de atajos; con el
 * dedo se convierte en la botonera de la fase, al alcance del pulgar y por
 * encima de la barra de gestos del móvil.
 */
export function HintBar({ children }) {
  const tactil = usePunteroGrueso()
  return (
    <div
      className={cx(
        'flex flex-wrap items-center justify-center border-t border-rule bg-paper',
        tactil
          ? 'gap-2 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
          : 'gap-x-7 gap-y-2 px-6 py-3',
      )}
    >
      {children}
    </div>
  )
}

/** Pantalla de espera mientras se importa el material activo */
export function DeckLoading({ name }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
      <span className="anim-pulse-ring rotulo">cargando material</span>
      <span className="text-[13px] text-ink-2">{name}</span>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {Icon && <Icon size={30} className="text-ink-4" />}
      <p className="rotulo">{title}</p>
      {children && <p className="max-w-md text-[13.5px] text-ink-2">{children}</p>}
    </div>
  )
}
