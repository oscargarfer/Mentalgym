import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Layers, Timer, Gauge, Target, CheckCircle2, XCircle, RotateCcw, Grid3x3, Rows3, Play, Sparkles,
  TriangleAlert, CalendarClock,
} from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { useKeydown, isTyping, blockScroll } from '../lib/useKeydown.js'
import {
  shuffle, clamp, answerMatchesAny, buildMeaningIndex, reverseTargets, fmtClock, round,
} from '../lib/utils.js'
import { drawIndices } from '../lib/bag.js'
import { sfx } from '../lib/sound.js'
import {
  Panel, Btn, Choice, Kbd, KeyHint, Stat, Progress, Countdown, HintBar, Badge, SectionTitle,
  NumberField, DeckLoading, cx,
} from '../components/ui.jsx'

const BATCH_PRESETS = [20, 50, 100, 200]

/* Reloj vivo aislado: evita re-renderizar el modulo entero cada 100 ms */
function LiveClock({ from, className = '' }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 97)
    return () => clearInterval(id)
  }, [])
  return <span className={className}>{fmtClock(performance.now() - from)}</span>
}

function colsFor(w) {
  if (w >= 1500) return 5
  if (w >= 1150) return 4
  if (w >= 780) return 3
  return 2
}

export default function Massive() {
  const { deck, addSession, setLocked, settings, registrarLote } = useApp()

  const [phase, setPhase] = useState('config') // config|countdown|load|bridge|test|done
  const [batch, setBatch] = useState(20)
  const [mode, setMode] = useState('single') // single | grid
  const [direction, setDirection] = useState('fw') // fw: extranjera->es | bw: es->extranjera

  const [items, setItems] = useState([])
  const [idx, setIdx] = useState(0)
  const [anchored, setAnchored] = useState(() => new Set())
  const loadStart = useRef(0)
  const [loadMs, setLoadMs] = useState(0)

  const [testItems, setTestItems] = useState([])
  const [ti, setTi] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState(null)
  const testStart = useRef(0)
  const answersRef = useRef([])

  const [summary, setSummary] = useState(null)
  // Feedback diferido tras cada respuesta. Se guarda para poder cancelarlo: si el
  // usuario aborta con ESC dentro de esa ventana, el temporizador pendiente
  // llegaba a llamar a finishTest y registraba en el historico una sesion abortada.
  const pendingRef = useRef(null)
  const inputRef = useRef(null)
  const cellRefs = useRef([])
  const [cols, setCols] = useState(() =>
    colsFor(typeof window === 'undefined' ? 1200 : window.innerWidth),
  )

  const maxBatch = deck.entries.length
  const running = phase !== 'config' && phase !== 'done'
  const meaningIndex = useMemo(() => buildMeaningIndex(deck.entries), [deck.entries])

  useEffect(() => {
    setLocked(running)
    return () => setLocked(false)
  }, [running, setLocked])

  useEffect(() => () => clearTimeout(pendingRef.current), [])

  useEffect(() => {
    const onResize = () => setCols(colsFor(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Un mazo pequeno (p. ej. importado) no puede quedar con un lote mayor que su tamano.
  // Se ignora mientras el mazo aun se esta importando, o el lote caeria a 1.
  useEffect(() => {
    if (!maxBatch) return
    setBatch((b) => clamp(b, 1, maxBatch))
  }, [maxBatch])

  /* ---------- Arranque ---------- */

  const start = useCallback(
    (reuse = null) => {
      const size = clamp(batch, 1, maxBatch)
      // Reparto de bolsa: los lotes recorren el mazo entero antes de repetir
      // ninguna palabra, en vez de sortear al azar y dejar huecos sin estudiar.
      const picked =
        reuse || drawIndices(`massive.${deck.id}`, deck.entries.length, size).map((i) => deck.entries[i])
      setItems(picked)
      setIdx(0)
      setAnchored(new Set())
      setLoadMs(0)
      setTestItems([])
      setTi(0)
      setInput('')
      setFeedback(null)
      setSummary(null)
      answersRef.current = []
      cellRefs.current = []
      setPhase('countdown')
    },
    [batch, maxBatch, deck],
  )

  const beginLoad = useCallback(() => {
    loadStart.current = performance.now()
    setPhase('load')
    sfx.start()
  }, [])

  const endLoad = useCallback(() => {
    const ms = performance.now() - loadStart.current
    setLoadMs(ms)
    setPhase('bridge')
    sfx.finish()
  }, [])

  /* ---------- Fase CARGA ---------- */

  const nextCard = useCallback(() => {
    if (idx + 1 >= items.length) endLoad()
    else {
      setIdx(idx + 1)
      sfx.tick()
    }
  }, [idx, items.length, endLoad])

  const prevCard = useCallback(() => setIdx((i) => Math.max(0, i - 1)), [])

  const anchorCell = useCallback(() => {
    const next = new Set(anchored)
    next.add(idx)
    setAnchored(next)
    sfx.tick()
    if (next.size >= items.length) {
      endLoad()
      return
    }
    // Salta a la siguiente celda sin anclar
    for (let step = 1; step <= items.length; step++) {
      const cand = (idx + step) % items.length
      if (!next.has(cand)) {
        setIdx(cand)
        break
      }
    }
  }, [anchored, idx, items.length, endLoad])

  const moveGrid = useCallback(
    (dx, dy) => {
      setIdx((i) => {
        let n = i + dx + dy * cols
        if (n < 0) n = 0
        if (n >= items.length) n = items.length - 1
        return n
      })
    },
    [cols, items.length],
  )

  useEffect(() => {
    if (phase === 'load' && mode === 'grid') {
      cellRefs.current[idx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [idx, phase, mode])

  /* ---------- Fase TEST ---------- */

  const beginTest = useCallback(() => {
    setTestItems(shuffle(items))
    setTi(0)
    setInput('')
    answersRef.current = []
    testStart.current = performance.now()
    setPhase('test')
    sfx.start()
  }, [items])

  const finishTest = useCallback(() => {
    const testMs = performance.now() - testStart.current
    const answers = answersRef.current
    const correct = answers.filter((a) => a.ok).length
    const total = answers.length
    const loadMin = loadMs / 60000
    const vrn = loadMin > 0 ? correct / loadMin : 0
    const s = {
      batch: total,
      mode,
      direction,
      loadMs: round(loadMs, 0),
      testMs: round(testMs, 0),
      correct,
      total,
      accuracy: total ? round((correct / total) * 100, 1) : 0,
      vrn: round(vrn, 2),
      secPerWord: total ? round(loadMs / 1000 / total, 2) : 0,
      answers,
    }
    setSummary(s)
    addSession({ module: 'massive', lang: deck.id, langName: deck.name, ...s })
    // Todo lo memorizado entra en el repaso espaciado: sin esto el VRN mide
    // cuánto entra, no cuánto queda.
    registrarLote(deck.id, answers)
    setPhase('done')
    sfx.finish()
  }, [loadMs, mode, direction, addSession, registrarLote, deck])

  const submitAnswer = useCallback(() => {
    const it = testItems[ti]
    if (!it) return
    // En sentido inverso vale la grafia original, su lectura (pinyin, kana,
    // transliteracion) y cualquier sinonimo del mazo con ese mismo significado.
    const expected = direction === 'fw' ? [it.m] : reverseTargets(it, meaningIndex)
    const ok = answerMatchesAny(input, expected)
    answersRef.current = [
      ...answersRef.current,
      { w: it.w, m: it.m, r: it.r, given: input.trim(), ok },
    ]
    setFeedback(ok ? 'ok' : 'fail')
    ok ? sfx.ok() : sfx.fail()

    pendingRef.current = setTimeout(
      () => {
        setFeedback(null)
        setInput('')
        if (ti + 1 >= testItems.length) finishTest()
        else setTi(ti + 1)
      },
      ok ? 260 : 700,
    )
  }, [testItems, ti, direction, input, finishTest, meaningIndex])

  useEffect(() => {
    if (phase === 'test' && !feedback) inputRef.current?.focus()
  }, [phase, ti, feedback])

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
      blockScroll(e)
      if (mode === 'single') {
        if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') nextCard()
        else if (e.key === 'ArrowLeft') prevCard()
      } else {
        if (e.key === ' ' || e.key === 'Enter') anchorCell()
        else if (e.key === 'ArrowRight') moveGrid(1, 0)
        else if (e.key === 'ArrowLeft') moveGrid(-1, 0)
        else if (e.key === 'ArrowDown') moveGrid(0, 1)
        else if (e.key === 'ArrowUp') moveGrid(0, -1)
      }
      return
    }
    if (phase === 'bridge') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); beginTest() }
      return
    }
    if (phase === 'test') {
      if (e.key === 'Enter' && !feedback) { e.preventDefault(); submitAnswer() }
      return
    }
    if (phase === 'done') {
      const k = e.key.toLowerCase()
      if (k === 'r') { e.preventDefault(); start(items) }
      if (k === 'n') { e.preventDefault(); start() }
    }
  })

  const failures = useMemo(
    () => (summary ? summary.answers.filter((a) => !a.ok) : []),
    [summary],
  )

  /* ======================= RENDER ======================= */

  if (deck.loading) return <DeckLoading name={deck.name} />

  if (phase === 'countdown') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Countdown from={3} onDone={beginLoad} label="FASE DE CARGA · MEMORIZACIÓN" />
      </div>
    )
  }

  /* --------- CARGA: modo tarjeta --------- */
  if (phase === 'load' && mode === 'single') {
    const it = items[idx]
    if (!it) return null
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopLoadBar idx={idx + 1} total={items.length} loadStart={loadStart.current} show={settings.showLoadTimer} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-10 px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-mute">
            palabra puente · imagen mental
          </span>
          <div key={idx} className="anim-pop flex flex-col items-center gap-6 text-center">
            <div
              className="font-mono text-5xl font-bold tracking-tight sm:text-7xl"
              style={{ color: deck.accent, textShadow: `0 0 40px ${deck.accent}55` }}
            >
              {it.w}
            </div>
            {it.r && <div className="font-mono text-base text-mute">{it.r}</div>}
            <div className="h-px w-24 bg-line" />
            <div className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-5xl">
              {it.m}
            </div>
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

  /* --------- CARGA: modo rejilla --------- */
  if (phase === 'load' && mode === 'grid') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TopLoadBar
          idx={anchored.size}
          total={items.length}
          loadStart={loadStart.current}
          show={settings.showLoadTimer}
          label="ANCLADAS"
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div
            className="grid gap-2.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
          >
            {items.map((it, i) => {
              const isAnchored = anchored.has(i)
              const focused = i === idx
              return (
                <div
                  key={`${it.w}-${i}`}
                  ref={(el) => { cellRefs.current[i] = el }}
                  className={cx(
                    'rounded-xl border px-3 py-3 transition-all duration-150',
                    focused
                      ? 'border-cy/70 bg-cy/8 glow-cy scale-[1.02]'
                      : isAnchored
                        ? 'border-gr/30 bg-gr/5'
                        : 'border-line bg-ink-900/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className="truncate font-mono text-sm font-bold"
                      style={{ color: isAnchored && !focused ? '#26ff9c' : deck.accent }}
                    >
                      {it.w}
                    </span>
                    <span className="font-mono text-[9px] text-mute">{i + 1}</span>
                  </div>
                  {it.r && <div className="truncate font-mono text-[10px] text-mute">{it.r}</div>}
                  <div className="mt-1 truncate text-[13px] text-slate-200">{it.m}</div>
                </div>
              )
            })}
          </div>
        </div>
        <HintBar>
          <KeyHint keys={['↑', '↓', '←', '→']} label="navegar" />
          <KeyHint keys={['ESPACIO']} label="anclar y saltar" tone="gr" />
          <KeyHint keys={['ESC']} label="abortar" />
        </HintBar>
      </div>
    )
  }

  /* --------- PUENTE entre carga y test --------- */
  if (phase === 'bridge') {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6">
        <Badge tone="gr">
          <CheckCircle2 size={11} /> CARGA COMPLETADA
        </Badge>
        <div className="text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-mute">
            tiempo de carga
          </div>
          <div className="mt-2 font-mono text-6xl font-bold text-cy text-glow tabular-nums">
            {fmtClock(loadMs)}
          </div>
          <div className="mt-3 font-mono text-xs text-mute">
            {items.length} palabras · {round(loadMs / 1000 / items.length, 2)} s por palabra
          </div>
        </div>
        <p className="max-w-md text-center text-sm text-mute">
          Respira. Cuando pulses <Kbd>ENTER</Kbd> empieza la evocación a contrarreloj en orden
          aleatorio.
        </p>
        <Btn tone="gr" size="lg" onClick={beginTest}>
          <Play size={13} className="mr-1.5 inline" /> Iniciar test · ENTER
        </Btn>
      </div>
    )
  }

  /* --------- TEST --------- */
  if (phase === 'test') {
    const it = testItems[ti]
    if (!it) return null
    const prompt = direction === 'fw' ? it.w : it.m
    const expected = direction === 'fw' ? it.m : it.w
    const okCount = answersRef.current.filter((a) => a.ok).length
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <Badge tone="vi">
            <Target size={11} /> EVOCACIÓN {ti + 1} / {testItems.length}
          </Badge>
          <div className="flex items-center gap-4 font-mono text-[11px] text-mute">
            <span>ACIERTOS <b className="text-gr">{okCount}</b></span>
            <LiveClock from={testStart.current} className="text-slate-300" />
          </div>
        </div>
        <div className="px-6 pt-3">
          <Progress value={ti} max={testItems.length} tone="vi" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-mute">
            {direction === 'fw' ? 'significado en español' : `escríbelo en ${deck.name}`}
          </span>
          <div
            key={ti}
            className="anim-pop text-center font-mono text-5xl font-bold sm:text-6xl"
            style={{ color: direction === 'fw' ? deck.accent : '#e2e8f0' }}
          >
            {prompt}
          </div>
          {/* autoCorrect y autoCapitalize apagados: en el movil el corrector
              reescribe la respuesta antes de que llegue a evaluarse, convierte
              un acierto en fallo y con ello falsea el VRN. */}
          <input
            ref={inputRef}
            value={input}
            disabled={!!feedback}
            onChange={(e) => setInput(e.target.value)}
            placeholder="respuesta..."
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            enterKeyHint="done"
            className={cx(
              'w-full max-w-xl rounded-xl border bg-ink-900/60 px-5 py-4 text-center font-mono text-2xl text-slate-100 transition-colors placeholder:text-slate-700',
              feedback === 'ok'
                ? 'border-gr/70 glow-gr'
                : feedback === 'fail'
                  ? 'border-rd/70 glow-rd'
                  : 'border-line focus:border-cy/60',
            )}
          />
          {feedback === 'fail' && (
            <div className="anim-in font-mono text-sm text-rd">
              era → <b className="text-slate-200">{expected}</b>
            </div>
          )}
        </div>

        <HintBar>
          <KeyHint keys={['ENTER']} label="confirmar (vacío = fallo)" tone="vi" />
          <KeyHint keys={['ESC']} label="abortar" />
        </HintBar>
      </div>
    )
  }

  /* --------- RESULTADO --------- */
  if (phase === 'done' && summary) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <SectionTitle icon={Layers} right={<Badge tone="gr">LOTE COMPLETADO</Badge>}>
            Rendimiento del bloque · {deck.name}
          </SectionTitle>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="VRN · Velocidad Retención Net"
              value={summary.vrn}
              unit="pal/min"
              tone="cy"
              icon={Gauge}
              sub={`${summary.correct} correctas / ${fmtClock(summary.loadMs)} de carga`}
            />
            <Stat
              label="Aciertos"
              value={`${summary.correct}/${summary.total}`}
              tone={summary.accuracy >= 90 ? 'gr' : summary.accuracy >= 70 ? 'am' : 'rd'}
              sub={`${summary.accuracy} % de precisión`}
              icon={Target}
            />
            <Stat
              label="Tiempo de carga"
              value={fmtClock(summary.loadMs)}
              icon={Timer}
              sub={`${summary.secPerWord} s por palabra`}
            />
            <Stat
              label="Tiempo de evocación"
              value={fmtClock(summary.testMs)}
              tone="vi"
              icon={Sparkles}
              sub={`${round(summary.testMs / 1000 / summary.total, 2)} s por respuesta`}
            />
          </div>

          <Panel className="mt-4">
            <SectionTitle icon={Gauge}>Cómo se calcula tu VRN</SectionTitle>
            <div className="rounded-xl border border-line-soft bg-ink-950/50 p-4 text-center font-mono text-sm">
              <span className="text-mute">VRN =</span>{' '}
              <span className="text-gr">{summary.correct} correctas</span>{' '}
              <span className="text-mute">/</span>{' '}
              <span className="text-cy">{round(summary.loadMs / 60000, 3)} min de carga</span>{' '}
              <span className="text-mute">=</span>{' '}
              <b className="text-xl text-cy text-glow">{summary.vrn}</b>{' '}
              <span className="text-mute">palabras/minuto</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-mute">
              El índice mide fuerza bruta real: solo cuenta lo que sobrevivió al test, dividido por
              el tiempo que tardaste en meterlo. Memorizar despacio con 100 % de acierto y
              memorizar rápido fallando la mitad dan índices parecidos: lo que sube el número es
              hacer las dos cosas a la vez.
            </p>
            <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-am">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              Este VRN solo es comparable con otros lotes de <b>{summary.batch}</b> palabras. Los
              lotes pequeños puntúan siempre más alto, así que en el dashboard la curva va separada
              por tamaño.
            </p>
          </Panel>

          <Panel className="mt-4 border-cy/25">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="font-mono text-sm font-bold text-cy">
                  Las {summary.total} palabras han entrado en el repaso espaciado.
                </div>
                <p className="mt-1 text-xs leading-relaxed text-mute">
                  Vuelven mañana. Este VRN mide lo que ha entrado; lo que de verdad cuenta es
                  cuántas sigues sabiendo en el repaso de 24 horas.
                </p>
              </div>
              <Badge tone="cy">
                <CalendarClock size={11} /> PRIMER REPASO EN 24 H
              </Badge>
            </div>
          </Panel>

          {failures.length > 0 && (
            <Panel className="mt-4">
              <SectionTitle icon={XCircle} right={<Badge tone="rd">{failures.length} fallos</Badge>}>
                Palabras a re-anclar
              </SectionTitle>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {failures.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-line-soft px-3 py-2 font-mono text-xs"
                  >
                    <XCircle size={13} className="shrink-0 text-rd" />
                    <span style={{ color: deck.accent }}>{f.w}</span>
                    <span className="text-mute">→</span>
                    <span className="text-slate-300">{f.m}</span>
                    {f.given && (
                      <span className="ml-auto truncate text-rd/70 line-through">{f.given}</span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Btn tone="cy" size="lg" onClick={() => start(items)}>
              <RotateCcw size={13} className="mr-1.5 inline" /> Repetir mismo lote · R
            </Btn>
            <Btn tone="gr" size="lg" onClick={() => start()}>
              Lote nuevo · N
            </Btn>
            <Btn tone="mute" onClick={() => setPhase('config')}>
              Configuración
            </Btn>
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
            Módulo 2 · <span className="text-cy">Memorización Masiva</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Carga un lote completo contra cronómetro de alta precisión, evócalo en orden aleatorio y
            obtén tu <b className="text-cy">VRN</b> (palabras correctas por minuto de carga). Es el
            indicador de fuerza bruta que se registra en el histórico.
          </p>
        </div>

        <Panel className="space-y-6">
          <div>
            <SectionTitle icon={Layers}>Tamaño del lote</SectionTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Choice
                options={BATCH_PRESETS.filter((b) => b <= maxBatch).map((b) => ({ value: b, label: `${b}` }))}
                value={batch}
                onChange={setBatch}
              />
              <NumberField
                value={batch}
                onChange={(v) => setBatch(clamp(v || 1, 1, maxBatch))}
                min={1}
                max={maxBatch}
                suffix={`de ${maxBatch}`}
              />
            </div>
          </div>

          <div>
            <SectionTitle icon={Grid3x3}>Formato de carga</SectionTitle>
            <Choice
              value={mode}
              onChange={setMode}
              options={[
                { value: 'single', label: '▸ Una a una' },
                { value: 'grid', label: '▦ Rejilla navegable' },
              ]}
            />
            <p className="mt-2 text-xs text-mute">
              {mode === 'single'
                ? 'Tarjeta a pantalla completa. ESPACIO / → avanza, ← retrocede.'
                : 'Todas las palabras en rejilla. Flechas para moverte, ESPACIO ancla la celda y salta a la siguiente sin anclar. La carga termina al anclar todas.'}
            </p>
          </div>

          <div>
            <SectionTitle icon={Rows3}>Dirección del test</SectionTitle>
            <Choice
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'fw', label: `${deck.tag} → ES` },
                { value: 'bw', label: `ES → ${deck.tag}` },
              ]}
            />
            <p className="mt-2 text-xs text-mute">
              {direction === 'fw'
                ? 'Ves la palabra extranjera y escribes su significado real en español (reconocimiento).'
                : 'Ves el significado español y escribes la palabra extranjera (producción, más exigente).'}
            </p>
          </div>
        </Panel>

        <div className="mt-5 flex items-center gap-3">
          <Btn tone="cy" size="lg" onClick={() => start()}>
            Iniciar bloque · ENTER
          </Btn>
          <span className="font-mono text-[11px] text-mute">
            {clamp(batch, 1, maxBatch)} palabras · {deck.name}
          </span>
        </div>
      </div>
    </div>
  )
}

function TopLoadBar({ idx, total, loadStart, show, label = 'CARGANDO' }) {
  return (
    <>
      <div className="flex items-center justify-between px-6 pt-5">
        <Badge tone="cy">
          <Layers size={11} /> {label} {String(idx).padStart(2, '0')} / {total}
        </Badge>
        {show && (
          <LiveClock from={loadStart} className="font-mono text-sm tabular-nums text-cy" />
        )}
      </div>
      <div className="px-6 pt-3">
        <Progress value={idx} max={total} />
      </div>
    </>
  )
}
