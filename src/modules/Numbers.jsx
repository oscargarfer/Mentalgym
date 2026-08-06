import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Hash, Timer, Target, RotateCcw, Play, Binary, Spade, Gauge, Eye, EyeOff, CheckCircle2, XCircle,
} from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { useKeydown, isTyping, blockScroll } from '../lib/useKeydown.js'
import { shuffle, clamp, round, fmtClock, norm } from '../lib/utils.js'
import { drawIndices } from '../lib/bag.js'
import { cartas, PALOS, TABLA_FONETICA } from '../data/pegs.js'
import { sfx } from '../lib/sound.js'
import {
  Panel, Btn, Choice, Kbd, KeyHint, Stat, Progress, Countdown, HintBar, Badge, SectionTitle,
  NumberField, cx,
} from '../components/ui.jsx'

/** Letra con la que se teclea cada palo, para poder responder sin ratón. */
const LETRA_PALO = { '♠': 'p', '♥': 'c', '♦': 'd', '♣': 't' }
const NOMBRE_PALO = { '♠': 'picas', '♥': 'corazones', '♦': 'diamantes', '♣': 'tréboles' }

const TIPOS = [
  { value: 'conversion', label: 'Conversión', icon: Hash },
  { value: 'decimal', label: 'Decimal', icon: Hash },
  { value: 'binario', label: 'Binario', icon: Binary },
  { value: 'baraja', label: 'Baraja', icon: Spade },
]

/* ---------- Generación y lectura de cada tipo ---------- */

/** Trocea la respuesta escrita en las mismas unidades que se memorizaron. */
function trocear(tipo, texto) {
  if (tipo === 'decimal') return (String(texto).match(/\d/g) || []).join('').match(/.{1,2}/g) || []
  if (tipo === 'binario') return (String(texto).match(/[01]/g) || []).join('').match(/.{1,3}/g) || []
  return String(texto)
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((t) => t.replace(/[^0-9ajqkpcdt]/g, ''))
}

const claveCarta = (c) => `${c.valor}${LETRA_PALO[c.palo]}`.toLowerCase()

export default function Numbers() {
  const { pegs, addSession, setLocked, settings } = useApp()

  const [phase, setPhase] = useState('config') // config | countdown | load | recall | done
  const [tipo, setTipo] = useState('conversion')
  const [cantidad, setCantidad] = useState(20)
  const [ayuda, setAyuda] = useState(false) // mostrar la palabra del casillero al memorizar

  const [items, setItems] = useState([])
  const [idx, setIdx] = useState(0)
  const loadStart = useRef(0)
  const [loadMs, setLoadMs] = useState(0)
  const [respuesta, setRespuesta] = useState('')
  const [summary, setSummary] = useState(null)

  // Ejercicio de conversión: pregunta y respuesta rápidas
  const [conv, setConv] = useState([])
  const [ci, setCi] = useState(0)
  const [convInput, setConvInput] = useState('')
  const [feedback, setFeedback] = useState(null)
  const shownAt = useRef(0)
  const convRef = useRef([])
  const pendingRef = useRef(null)
  const inputRef = useRef(null)

  const baraja = useMemo(() => cartas(pegs), [pegs])
  const running = phase !== 'config' && phase !== 'done'

  useEffect(() => {
    setLocked(running)
    return () => setLocked(false)
  }, [running, setLocked])
  useEffect(() => () => clearTimeout(pendingRef.current), [])

  const maxCantidad = tipo === 'baraja' ? 52 : tipo === 'binario' ? 60 : 50
  useEffect(() => {
    setCantidad((c) => clamp(c, 4, maxCantidad))
  }, [maxCantidad])

  /* ---------- Arranque ---------- */

  const start = useCallback(() => {
    if (tipo === 'conversion') {
      // Reparto de bolsa sobre las 100 casillas: recorre el casillero entero
      const preguntas = drawIndices('numeros.casillero', 100, cantidad).map((n) => ({
        n,
        par: String(n).padStart(2, '0'),
        palabra: pegs[n],
      }))
      setConv(preguntas)
      setCi(0)
      setConvInput('')
      convRef.current = []
      setFeedback(null)
      setSummary(null)
      setPhase('countdown')
      return
    }

    let unidades = []
    if (tipo === 'decimal') {
      unidades = Array.from({ length: cantidad }, () => {
        const n = Math.floor(Math.random() * 100)
        return { clave: String(n).padStart(2, '0'), etiqueta: String(n).padStart(2, '0'), palabra: pegs[n] }
      })
    } else if (tipo === 'binario') {
      unidades = Array.from({ length: cantidad }, () => {
        const v = Math.floor(Math.random() * 8)
        const bits = v.toString(2).padStart(3, '0')
        return { clave: bits, etiqueta: bits, decimal: String(v), palabra: null }
      })
    } else {
      unidades = shuffle(baraja)
        .slice(0, cantidad)
        .map((c) => ({ clave: claveCarta(c), etiqueta: `${c.valor}${c.palo}`, palabra: c.palabra }))
    }
    setItems(unidades)
    setIdx(0)
    setLoadMs(0)
    setRespuesta('')
    setSummary(null)
    setPhase('countdown')
  }, [tipo, cantidad, pegs, baraja])

  const beginLoad = useCallback(() => {
    if (tipo === 'conversion') {
      setPhase('load')
      shownAt.current = performance.now()
    } else {
      loadStart.current = performance.now()
      setPhase('load')
    }
    sfx.start()
  }, [tipo])

  /* ---------- Conversión: pregunta → respuesta ---------- */

  const finishConversion = useCallback(
    (res) => {
      const correct = res.filter((r) => r.ok).length
      const tiempos = res.map((r) => r.ms)
      const s = {
        tipo: 'conversion',
        total: res.length,
        correct,
        accuracy: res.length ? round((correct / res.length) * 100, 1) : 0,
        msMedio: round(tiempos.reduce((a, b) => a + b, 0) / (tiempos.length || 1), 0),
        msMejor: round(Math.min(...tiempos), 0),
        fallos: res.filter((r) => !r.ok).map((r) => ({ par: r.par, palabra: r.palabra, given: r.given })),
      }
      setSummary(s)
      addSession({ module: 'numbers', ...s })
      setPhase('done')
      sfx.finish()
    },
    [addSession],
  )

  const submitConversion = useCallback(() => {
    const q = conv[ci]
    if (!q) return
    const ms = performance.now() - shownAt.current
    const ok = norm(convInput) === norm(q.palabra)
    const res = [...convRef.current, { ...q, ok, ms, given: convInput.trim() }]
    convRef.current = res
    setFeedback(ok ? 'ok' : 'fail')
    ok ? sfx.ok() : sfx.fail()
    pendingRef.current = setTimeout(
      () => {
        setFeedback(null)
        setConvInput('')
        if (ci + 1 >= conv.length) finishConversion(res)
        else {
          setCi(ci + 1)
          shownAt.current = performance.now()
        }
      },
      ok ? 260 : 800,
    )
  }, [conv, ci, convInput, finishConversion])

  /* ---------- Series: carga → evocación en orden ---------- */

  const endLoad = useCallback(() => {
    setLoadMs(performance.now() - loadStart.current)
    setPhase('recall')
    sfx.tick()
  }, [])

  const nextItem = useCallback(() => {
    if (idx + 1 >= items.length) endLoad()
    else {
      setIdx(idx + 1)
      sfx.tick()
    }
  }, [idx, items.length, endLoad])

  const finishSerie = useCallback(() => {
    const dadas = trocear(tipo, respuesta)
    const claves = items.map((it) => it.clave)
    // Aciertos posicionales y, sobre todo, cuánta secuencia se mantuvo intacta
    // desde el principio: en datos ordenados, romper por el medio lo invalida todo.
    let correctos = 0
    let intacta = 0
    let seguimos = true
    claves.forEach((c, i) => {
      const ok = (dadas[i] || '') === c
      if (ok) correctos++
      if (seguimos && ok) intacta++
      else seguimos = false
    })
    const unidadesPorDigito = tipo === 'decimal' ? 2 : tipo === 'binario' ? 3 : 1
    const loadMin = loadMs / 60000
    const s = {
      tipo,
      total: claves.length,
      correctos,
      intacta,
      accuracy: claves.length ? round((correctos / claves.length) * 100, 1) : 0,
      loadMs: round(loadMs, 0),
      digitos: claves.length * unidadesPorDigito,
      porMinuto: loadMin > 0 ? round((correctos * unidadesPorDigito) / loadMin, 1) : 0,
      detalle: claves.map((c, i) => ({ esperado: c, dado: dadas[i] || '', ok: (dadas[i] || '') === c })),
    }
    setSummary(s)
    addSession({ module: 'numbers', ...s })
    setPhase('done')
    sfx.finish()
  }, [tipo, respuesta, items, loadMs, addSession])

  useEffect(() => {
    if ((phase === 'load' && tipo === 'conversion' && !feedback) || phase === 'recall') {
      inputRef.current?.focus()
    }
  }, [phase, tipo, ci, feedback])

  /* ---------- Teclado ---------- */

  useKeydown((e) => {
    if (phase === 'config') {
      if (e.key === 'Enter' && !isTyping(e)) { e.preventDefault(); start() }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      clearTimeout(pendingRef.current)
      setFeedback(null)
      setPhase('config')
      return
    }
    if (phase === 'load') {
      if (tipo === 'conversion') {
        if (e.key === 'Enter' && !feedback) { e.preventDefault(); submitConversion() }
        return
      }
      blockScroll(e)
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') nextItem()
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      return
    }
    if (phase === 'done' && e.key.toLowerCase() === 'r') { e.preventDefault(); start() }
  })

  /* ======================= RENDER ======================= */

  if (phase === 'countdown') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Countdown
          from={3}
          onDone={beginLoad}
          label={tipo === 'conversion' ? 'CASILLERO · CONVERSIÓN RÁPIDA' : 'MEMORIZA LA SERIE EN ORDEN'}
        />
      </div>
    )
  }

  /* --------- Conversión --------- */
  if (phase === 'load' && tipo === 'conversion') {
    const q = conv[ci]
    if (!q) return null
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <Badge tone="vi"><Hash size={11} /> CONVERSIÓN {ci + 1} / {conv.length}</Badge>
          <span className="font-mono text-[11px] text-mute">¿qué palabra ocupa esta casilla?</span>
        </div>
        <div className="px-6 pt-3"><Progress value={ci} max={conv.length} tone="vi" /></div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6">
          <div key={ci} className="anim-pop font-mono text-8xl font-bold text-vi text-glow tabular-nums">
            {q.par}
          </div>
          <input
            ref={inputRef}
            value={convInput}
            disabled={!!feedback}
            onChange={(e) => setConvInput(e.target.value)}
            placeholder="palabra del casillero..."
            autoComplete="off"
            spellCheck={false}
            className={cx(
              'w-full max-w-lg rounded-xl border bg-ink-900/60 px-5 py-4 text-center font-mono text-2xl text-slate-100 transition-colors placeholder:text-slate-700',
              feedback === 'ok' ? 'border-gr/70 glow-gr'
                : feedback === 'fail' ? 'border-rd/70 glow-rd'
                  : 'border-line focus:border-vi/60',
            )}
          />
          {feedback === 'fail' && (
            <div className="anim-in font-mono text-sm text-rd">
              era → <b className="text-slate-200">{q.palabra}</b>
            </div>
          )}
        </div>
        <HintBar>
          <KeyHint keys={['ENTER']} label="confirmar" tone="vi" />
          <KeyHint keys={['ESC']} label="abortar" />
        </HintBar>
      </div>
    )
  }

  /* --------- Carga de series --------- */
  if (phase === 'load') {
    const it = items[idx]
    if (!it) return null
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <Badge tone="cy">MEMORIZANDO {idx + 1} / {items.length}</Badge>
          <span className="font-mono text-[11px] text-mute">
            {tipo === 'binario' ? 'trío → dígito → casillero' : 'convierte y encadena'}
          </span>
        </div>
        <div className="px-6 pt-3"><Progress value={idx + 1} max={items.length} /></div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6">
          <div key={idx} className="anim-pop flex flex-col items-center gap-4">
            <div className="font-mono text-8xl font-bold tracking-widest text-slate-100 tabular-nums">
              {it.etiqueta}
            </div>
            {tipo === 'binario' && (
              <div className="font-mono text-3xl font-bold text-am">→ {it.decimal}</div>
            )}
            {ayuda && it.palabra && (
              <div className="font-mono text-2xl text-cy">{it.palabra}</div>
            )}
          </div>
        </div>

        <HintBar>
          <KeyHint keys={['ESPACIO', '→']} label="siguiente" tone="cy" />
          <KeyHint keys={['←']} label="anterior" />
          <KeyHint keys={['ESC']} label="abortar" />
        </HintBar>
      </div>
    )
  }

  /* --------- Evocación en orden --------- */
  if (phase === 'recall') {
    const dadas = trocear(tipo, respuesta)
    const ayudaTexto =
      tipo === 'decimal' ? 'Escribe las cifras seguidas, en el mismo orden.'
        : tipo === 'binario' ? 'Escribe los ceros y unos seguidos, en el mismo orden.'
          : 'Escribe las cartas separadas por espacios: valor + palo (p picas, c corazones, d diamantes, t tréboles). Ej: as 10c kd 7t'
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <SectionTitle icon={Target} right={<Badge tone="vi">EVOCACIÓN EN ORDEN</Badge>}>
            Reconstruye la serie
          </SectionTitle>
          <p className="mb-3 text-xs text-mute">{ayudaTexto}</p>
          <textarea
            ref={inputRef}
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            rows={5}
            spellCheck={false}
            className="w-full rounded-xl border border-line bg-ink-950/60 p-4 font-mono text-xl tracking-widest text-slate-100 placeholder:text-slate-700 focus:border-vi/60"
            placeholder={tipo === 'baraja' ? 'as 10c kd ...' : tipo === 'binario' ? '101 011 ...' : '07 14 52 ...'}
          />
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-mute">
            <span>
              has escrito <b className="text-slate-300">{dadas.length}</b> de {items.length} unidades
            </span>
            <span>{tipo !== 'baraja' && `${dadas.join('').length} cifras`}</span>
          </div>
          <div className="mt-5 flex gap-3">
            <Btn tone="vi" size="lg" onClick={finishSerie}>
              Corregir
            </Btn>
            <Btn tone="mute" onClick={() => setPhase('config')}>
              Abortar
            </Btn>
          </div>
        </div>
      </div>
    )
  }

  /* --------- Resultado --------- */
  if (phase === 'done' && summary) {
    const esConversion = summary.tipo === 'conversion'
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <SectionTitle icon={Hash} right={<Badge tone="gr">SESIÓN COMPLETADA</Badge>}>
            {esConversion ? 'Automatismo del casillero' : 'Memoria numérica en orden'}
          </SectionTitle>

          {esConversion ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Aciertos" value={`${summary.correct}/${summary.total}`} tone={summary.accuracy >= 90 ? 'gr' : 'am'} sub={`${summary.accuracy} %`} icon={Target} />
              <Stat label="Tiempo medio" value={summary.msMedio} unit="ms" icon={Timer} sub="por conversión" />
              <Stat label="Mejor" value={summary.msMejor} unit="ms" tone="gr" />
              <Stat label="Objetivo" value="< 1000" unit="ms" tone="vi" sub="casillero automático" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Secuencia intacta"
                value={summary.intacta}
                unit={`de ${summary.total}`}
                tone={summary.intacta === summary.total ? 'gr' : summary.intacta > summary.total / 2 ? 'am' : 'rd'}
                icon={Target}
                sub="antes del primer fallo"
              />
              <Stat label="Aciertos totales" value={`${summary.correctos}/${summary.total}`} sub={`${summary.accuracy} %`} />
              <Stat label="Velocidad" value={summary.porMinuto} unit={summary.tipo === 'baraja' ? 'cartas/min' : 'cifras/min'} tone="cy" icon={Gauge} />
              <Stat label="Tiempo de carga" value={fmtClock(summary.loadMs)} icon={Timer} />
            </div>
          )}

          <Panel className="mt-4">
            <SectionTitle icon={esConversion ? Timer : Target}>Detalle</SectionTitle>
            {esConversion ? (
              summary.fallos.length ? (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {summary.fallos.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-line-soft px-3 py-2 font-mono text-xs">
                      <XCircle size={13} className="shrink-0 text-rd" />
                      <span className="text-vi">{f.par}</span>
                      <span className="text-mute">→</span>
                      <span className="text-slate-300">{f.palabra}</span>
                      {f.given && <span className="ml-auto truncate text-rd/70 line-through">{f.given}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-gr">
                  <CheckCircle2 size={15} /> Casillero perfecto. Ahora baja el tiempo por conversión.
                </p>
              )
            ) : (
              <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                {summary.detalle.map((d, i) => (
                  <span
                    key={i}
                    title={d.ok ? d.esperado : `esperado ${d.esperado}, escribiste ${d.dado || '—'}`}
                    className={cx(
                      'rounded border px-2 py-1',
                      d.ok ? 'border-gr/40 bg-gr/8 text-gr' : 'border-rd/40 bg-rd/8 text-rd',
                    )}
                  >
                    {d.esperado}
                    {!d.ok && <span className="ml-1 opacity-60 line-through">{d.dado || '—'}</span>}
                  </span>
                ))}
              </div>
            )}
          </Panel>

          <div className="mt-5 flex flex-wrap gap-3">
            <Btn tone="cy" size="lg" onClick={start}>
              <RotateCcw size={13} className="mr-1.5 inline" /> Repetir · R
            </Btn>
            <Btn tone="mute" onClick={() => setPhase('config')}>Configuración</Btn>
          </div>
        </div>
      </div>
    )
  }

  /* --------- CONFIG --------- */
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-100">
            Módulo 6 · <span className="text-cy">Números y casillero</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Un número no se puede visualizar, y lo que no se visualiza no se asocia. El casillero
            fonético convierte cada par de cifras en una palabra concreta: a partir de ahí un número
            se memoriza como cualquier otra imagen. Primero automatiza el casillero con la
            conversión; después ya puedes con series, binario y baraja.
          </p>
        </div>

        <Panel className="space-y-6">
          <div>
            <SectionTitle icon={Hash}>Ejercicio</SectionTitle>
            <Choice value={tipo} onChange={setTipo} options={TIPOS.map((t) => ({ value: t.value, label: t.label }))} />
            <p className="mt-2 text-xs leading-relaxed text-mute">
              {tipo === 'conversion' && 'Aparece una casilla (00-99) y escribes su palabra. Es el drill que hace automático el casillero: sin esto, lo demás va lento.'}
              {tipo === 'decimal' && 'Serie de cifras al azar. Las conviertes de dos en dos y las encadenas; luego reconstruyes la serie entera en orden.'}
              {tipo === 'binario' && 'Serie de ceros y unos agrupada de tres en tres (000→0 … 111→7). Cada trío da un dígito, cada dos dígitos una palabra.'}
              {tipo === 'baraja' && 'Cartas en orden aleatorio. Cada una tiene su palabra fija; memorizas el recorrido y lo reconstruyes en secuencia.'}
            </p>
          </div>

          <div>
            <SectionTitle icon={Timer}>
              {tipo === 'conversion' ? 'Conversiones' : tipo === 'baraja' ? 'Cartas' : tipo === 'binario' ? 'Tríos' : 'Pares de cifras'}
            </SectionTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Choice
                options={(tipo === 'baraja' ? [10, 20, 32, 52] : [10, 20, 30, 50]).filter((n) => n <= maxCantidad).map((n) => ({ value: n, label: `${n}` }))}
                value={cantidad}
                onChange={setCantidad}
              />
              <NumberField value={cantidad} onChange={(v) => setCantidad(clamp(v || 4, 4, maxCantidad))} min={4} max={maxCantidad} suffix={`máx ${maxCantidad}`} />
              {tipo !== 'conversion' && (
                <span className="font-mono text-[11px] text-mute">
                  {tipo === 'decimal' && `${cantidad * 2} cifras`}
                  {tipo === 'binario' && `${cantidad * 3} bits`}
                  {tipo === 'baraja' && `${cantidad} de 52`}
                </span>
              )}
            </div>
          </div>

          {tipo !== 'conversion' && (
            <div>
              <SectionTitle icon={ayuda ? Eye : EyeOff}>Muleta</SectionTitle>
              <Choice
                value={ayuda}
                onChange={setAyuda}
                options={[
                  { value: false, label: 'Sin ayuda' },
                  { value: true, label: 'Mostrar la palabra' },
                ]}
              />
              <p className="mt-2 text-xs text-mute">
                {ayuda
                  ? 'Se muestra la palabra del casillero bajo cada unidad. Útil las primeras veces; quítala en cuanto puedas o no automatizarás la tabla.'
                  : 'Conviertes tú. Es como debe entrenarse una vez sabido el casillero.'}
              </p>
            </div>
          )}
        </Panel>

        <div className="mt-5 flex items-center gap-3">
          <Btn tone="cy" size="lg" onClick={start}>
            <Play size={13} className="mr-1.5 inline" /> Empezar · ENTER
          </Btn>
          {tipo === 'baraja' && (
            <span className="font-mono text-[11px] text-mute">
              {PALOS.map((p) => `${p} ${LETRA_PALO[p]} = ${NOMBRE_PALO[p]}`).join('  ·  ')}
            </span>
          )}
        </div>

        <Panel className="mt-4">
          <SectionTitle icon={Hash}>La tabla</SectionTitle>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {TABLA_FONETICA.map((f) => (
              <div key={f.d} className="flex items-center gap-3 rounded-lg border border-line-soft px-3 py-2">
                <span className="font-mono text-xl font-bold text-cy">{f.d}</span>
                <span className="font-mono text-sm text-slate-200">{f.letras}</span>
                <span className="ml-auto text-[11px] text-mute">{f.pista}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-mute">
            Las vocales son libres. Solo cuentan las dos primeras consonantes. Puedes cambiar
            cualquiera de las 100 palabras en <Kbd>9</Kbd> Ajustes: el casillero funciona mejor si
            las imágenes son tuyas.
          </p>
        </Panel>
      </div>
    </div>
  )
}
