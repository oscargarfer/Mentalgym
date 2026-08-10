import { useEffect, useState } from 'react'
import { usePunteroGrueso, teclaDe, pulsar } from '../lib/tactil.js'

export const cx = (...c) => c.filter(Boolean).join(' ')

/* ---------------- Tecla ---------------- */

export function Kbd({ children, tone = 'cy', className = '' }) {
  const tones = {
    cy: 'border-cy/40 text-cy bg-cy/5',
    gr: 'border-gr/40 text-gr bg-gr/5',
    rd: 'border-rd/40 text-rd bg-rd/5',
    am: 'border-am/40 text-am bg-am/5',
    vi: 'border-vi/40 text-vi bg-vi/5',
    mute: 'border-line text-mute bg-white/2',
  }
  return (
    <kbd
      className={cx(
        'inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
        tones[tone],
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
    const tonos = {
      cy: 'border-cy/50 bg-cy/10 text-cy',
      gr: 'border-gr/50 bg-gr/10 text-gr',
      rd: 'border-rd/50 bg-rd/10 text-rd',
      am: 'border-am/50 bg-am/10 text-am',
      vi: 'border-vi/50 bg-vi/10 text-vi',
      mute: 'border-line bg-white/4 text-mute',
    }
    return (
      <button
        type="button"
        // Sin esto, tocar el botón le quita el foco al campo de respuesta y el
        // teclado del móvil se cierra y se vuelve a abrir en cada pulsación.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => pulsar(tecla)}
        className={cx(
          'inline-flex min-h-[46px] flex-1 items-center justify-center rounded-xl border px-4 text-center text-[13px] font-medium leading-tight transition-transform active:scale-[0.97]',
          tone === 'mute' ? 'max-w-[34%] grow-0' : 'grow',
          tonos[tone] || tonos.mute,
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-mute">
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
    <div className={cx('panel p-5', accent && 'glow-cy', className)}>{children}</div>
  )
}

export function SectionTitle({ icon: Icon, children, right }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-mute">
        {Icon && <Icon size={13} className="text-cy" />}
        {children}
      </h2>
      {right}
    </div>
  )
}

/* ---------------- Botones y selectores ---------------- */

export function Btn({ children, onClick, tone = 'cy', size = 'md', className = '', disabled, type = 'button' }) {
  const tones = {
    cy: 'border-cy/40 text-cy hover:bg-cy/12 hover:border-cy/70',
    gr: 'border-gr/40 text-gr hover:bg-gr/12 hover:border-gr/70',
    rd: 'border-rd/40 text-rd hover:bg-rd/12 hover:border-rd/70',
    vi: 'border-vi/40 text-vi hover:bg-vi/12 hover:border-vi/70',
    mute: 'border-line text-ink-2 hover:bg-white/5 hover:border-ink-3',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-[11px]',
    md: 'px-4 py-2 text-xs',
    lg: 'px-6 py-3 text-sm',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'rounded-xl border bg-transparent font-mono font-bold uppercase tracking-wider transition-all duration-150 active:scale-95',
        tones[tone],
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
  return (
    <div className={cx('flex flex-wrap gap-2', className)}>
      {options.map((o) => {
        const val = typeof o === 'object' ? o.value : o
        const label = typeof o === 'object' ? o.label : o
        const active = val === value
        return (
          <button
            key={String(val)}
            type="button"
            onClick={() => onChange(val)}
            className={cx(
              'rounded-lg border px-3.5 py-2 font-mono text-xs font-bold tracking-wide transition-all active:scale-95',
              active
                ? 'border-cy/70 bg-cy/12 text-cy glow-cy'
                : 'border-line text-mute hover:border-ink-3 hover:text-ink-2',
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
    <div className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-1.5">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 bg-transparent text-center font-mono text-sm font-bold text-cy"
      />
      {suffix && <span className="font-mono text-[10px] uppercase text-mute">{suffix}</span>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-lg border border-line px-4 py-3 text-left transition-colors hover:border-ink-4"
    >
      <span className="text-sm text-ink-2">{label}</span>
      <span
        className={cx(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
          checked ? 'border-cy/60 bg-cy/25' : 'border-line bg-white/5',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all',
            checked ? 'left-[18px] bg-cy' : 'left-0.5 bg-ink-3',
          )}
        />
      </span>
    </button>
  )
}

/* ---------------- Metricas ---------------- */

export function Stat({ label, value, unit, tone = 'cy', sub, icon: Icon }) {
  const tones = { cy: 'text-cy', gr: 'text-gr', rd: 'text-rd', am: 'text-am', vi: 'text-vi' }
  return (
    <div className="panel relative overflow-hidden p-4">
      <div className="flex items-start justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">{label}</span>
        {Icon && <Icon size={14} className={cx('opacity-60', tones[tone])} />}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cx('font-mono text-3xl font-bold tabular-nums', tones[tone])}>{value}</span>
        {unit && <span className="font-mono text-[11px] uppercase text-mute">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-[11px] text-mute">{sub}</div>}
    </div>
  )
}

export function Progress({ value, max, tone = 'cy' }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  const bg = { cy: 'bg-cy', gr: 'bg-gr', vi: 'bg-vi', am: 'bg-am' }[tone]
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className={cx('h-full rounded-full transition-[width] duration-200', bg)}
        style={{ width: `${pct}%`, boxShadow: '0 0 12px currentColor' }}
      />
    </div>
  )
}

export function Badge({ children, tone = 'cy' }) {
  const tones = {
    cy: 'border-cy/35 text-cy bg-cy/8',
    gr: 'border-gr/35 text-gr bg-gr/8',
    rd: 'border-rd/35 text-rd bg-rd/8',
    am: 'border-am/35 text-am bg-am/8',
    vi: 'border-vi/35 text-vi bg-vi/8',
    mute: 'border-line text-mute bg-white/3',
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

/* ---------------- Cuenta atras ---------------- */

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
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <span className="font-mono text-[11px] uppercase tracking-[0.4em] text-mute">{label}</span>
      <div
        key={n}
        className="anim-pop flex h-32 w-32 items-center justify-center rounded-full border border-cy/40 font-mono text-6xl font-bold text-cy text-glow anim-pulse-ring"
      >
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
        'flex flex-wrap items-center justify-center border-t border-line-soft bg-ink-950/70 backdrop-blur',
        tactil
          ? 'gap-2 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
          : 'gap-x-6 gap-y-2 px-6 py-3',
      )}
    >
      {children}
    </div>
  )
}

/** Pantalla de espera mientras se importa el mazo del idioma activo */
export function DeckLoading({ name }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
      <div className="h-2 w-2 rounded-full bg-cy anim-pulse-ring" />
      <span className="font-mono text-[11px] uppercase tracking-[0.35em] text-mute">
        cargando vocabulario · {name}
      </span>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      {Icon && <Icon size={36} className="text-line" />}
      <p className="font-mono text-sm uppercase tracking-widest text-mute">{title}</p>
      {children && <p className="max-w-md text-sm text-ink-3">{children}</p>}
    </div>
  )
}
