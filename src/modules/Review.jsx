import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarClock, Target, CheckCircle2, XCircle, RotateCcw, Play, Brain, Layers, TrendingUp,
} from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { useKeydown, isTyping } from '../lib/useKeydown.js'
import { shuffle, answerMatchesAny, round, fmtClock, fmtDateTime } from '../lib/utils.js'
import { vencidas, proximoVencimiento, ETAPA_CONSOLIDADA } from '../lib/srs.js'
import { sfx } from '../lib/sound.js'
import {
  Panel, Btn, Choice, Kbd, KeyHint, Stat, Progress, Countdown, HintBar, Badge, SectionTitle,
  EmptyState, cx,
} from '../components/ui.jsx'

/**
 * Repaso espaciado. Es el módulo que convierte la carga en retención: cada
 * palabra memorizada vuelve a preguntarse a las 24 h, y luego cada vez más
 * tarde mientras se acierte. Un fallo la devuelve al principio.
 */
export default function Review() {
  const { reviews, registrarRepaso, addSession, setLocked, settings, deck, allDecks } = useApp()

  const [phase, setPhase] = useState('config') // config | countdown | test | done
  const [ambito, setAmbito] = useState('todos') // todos | idioma activo
  const [items, setItems] = useState([])
  const [ti, setTi] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [summary, setSummary] = useState(null)
  const testStart = useRef(0)
  const answersRef = useRef([])
  const pendingRef = useRef(null)
  const inputRef = useRef(null)

  const running = phase !== 'config' && phase !== 'done'
  useEffect(() => {
    setLocked(running)
    return () => setLocked(false)
  }, [running, setLocked])

  useEffect(() => () => clearTimeout(pendingRef.current), [])

  const ahora = Date.now()
  const candidatas = useMemo(
    () => (ambito === 'todos' ? reviews : reviews.filter((f) => f.lang === deck.id)),
    [reviews, ambito, deck.id],
  )
  const cola = useMemo(
    () => vencidas(candidatas, ahora, settings.topeRepasoDiario),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidatas, settings.topeRepasoDiario],
  )
  const proximo = useMemo(() => proximoVencimiento(candidatas, ahora), [candidatas]) // eslint-disable-line react-hooks/exhaustive-deps
  const nombreIdioma = (id) => allDecks.find((d) => d.id === id)?.name || id

  /* ---------- Sesión ---------- */

  const start = useCallback(() => {
    if (!cola.length) return
    // Se barajan para que el orden de la cola no se convierta en pista
    setItems(shuffle(cola))
    setTi(0)
    setInput('')
    setFeedback(null)
    setSummary(null)
    answersRef.current = []
    setPhase('countdown')
  }, [cola])

  const beginTest = useCallback(() => {
    testStart.current = performance.now()
    setPhase('test')
    sfx.start()
  }, [])

  const finish = useCallback(() => {
    const testMs = performance.now() - testStart.current
    const res = answersRef.current
    const correct = res.filter((a) => a.ok).length
    // "Primeros" son las fichas que nunca se habían repasado: su acierto es la
    // retención real a 24 h, la única cifra que dice si lo memorizado se queda.
    const primeros = res.filter((a) => a.primerRepaso)
    const s = {
      total: res.length,
      correct,
      accuracy: res.length ? round((correct / res.length) * 100, 1) : 0,
      primeros: primeros.length,
      primerosOk: primeros.filter((a) => a.ok).length,
      retencion24h: primeros.length
        ? round((primeros.filter((a) => a.ok).length / primeros.length) * 100, 1)
        : null,
      testMs: round(testMs, 0),
      ambito,
      fallos: res.filter((a) => !a.ok).map((a) => ({ w: a.w, m: a.m, lang: a.lang })),
    }
    setSummary(s)
    registrarRepaso(res.map((a) => ({ id: a.id, ok: a.ok })))
    addSession({ module: 'review', ...s })
    setPhase('done')
    sfx.finish()
  }, [ambito, registrarRepaso, addSession])

  const submit = useCallback(() => {
    const f = items[ti]
    if (!f) return
    const ok = answerMatchesAny(input, [f.m])
    answersRef.current = [
      ...answersRef.current,
      {
        id: f.id, w: f.w, m: f.m, lang: f.lang, ok,
        primerRepaso: f.repasos === 0,
        given: input.trim(),
      },
    ]
    setFeedback(ok ? 'ok' : 'fail')
    ok ? sfx.ok() : sfx.fail()
    pendingRef.current = setTimeout(
      () => {
        setFeedback(null)
        setInput('')
        if (ti + 1 >= items.length) finish()
        else setTi(ti + 1)
      },
      ok ? 260 : 750,
    )
  }, [items, ti, input, finish])

  useEffect(() => {
    if (phase === 'test' && !feedback) inputRef.current?.focus()
  }, [phase, ti, feedback])

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
    if (phase === 'test' && e.key === 'Enter' && !feedback) { e.preventDefault(); submit() }
    if (phase === 'done' && e.key.toLowerCase() === 'r') { e.preventDefault(); setPhase('config') }
  })

  /* ======================= RENDER ======================= */

  if (phase === 'countdown') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Countdown from={3} onDone={beginTest} label="REPASO · ¿QUÉ HA SOBREVIVIDO?" />
      </div>
    )
  }

  if (phase === 'test') {
    const f = items[ti]
    if (!f) return null
    const okCount = answersRef.current.filter((a) => a.ok).length
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <Badge tone="gr">
            <CalendarClock size={11} /> REPASO {ti + 1} / {items.length}
          </Badge>
          <div className="flex items-center gap-4 font-mono text-[11px] text-mute">
            <span>ACIERTOS <b className="text-gr">{okCount}</b></span>
            {f.repasos === 0 && <Badge tone="am">PRIMER REPASO</Badge>}
          </div>
        </div>
        <div className="px-6 pt-3">
          <Progress value={ti} max={items.length} tone="gr" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-mute">
            significado en español · {nombreIdioma(f.lang)}
          </span>
          <div key={ti} className="anim-pop text-center font-mono text-5xl font-bold text-cy sm:text-6xl">
            {f.w}
          </div>
          {f.r && <div className="font-mono text-sm text-mute">{f.r}</div>}
          <input
            ref={inputRef}
            value={input}
            disabled={!!feedback}
            onChange={(e) => setInput(e.target.value)}
            placeholder="respuesta..."
            autoComplete="off"
            spellCheck={false}
            className={cx(
              'w-full max-w-xl rounded-xl border bg-ink-900/60 px-5 py-4 text-center font-mono text-2xl text-slate-100 transition-colors placeholder:text-slate-700',
              feedback === 'ok'
                ? 'border-gr/70 glow-gr'
                : feedback === 'fail'
                  ? 'border-rd/70 glow-rd'
                  : 'border-line focus:border-gr/60',
            )}
          />
          {feedback === 'fail' && (
            <div className="anim-in font-mono text-sm text-rd">
              era → <b className="text-slate-200">{f.m}</b>
            </div>
          )}
        </div>

        <HintBar>
          <KeyHint keys={['ENTER']} label="confirmar (vacío = fallo)" tone="gr" />
          <KeyHint keys={['ESC']} label="abortar" />
        </HintBar>
      </div>
    )
  }

  if (phase === 'done' && summary) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <SectionTitle icon={CalendarClock} right={<Badge tone="gr">REPASO COMPLETADO</Badge>}>
            Lo que ha sobrevivido
          </SectionTitle>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Retención a 24 h"
              value={summary.retencion24h ?? '--'}
              unit="%"
              tone={
                summary.retencion24h == null ? 'cy'
                  : summary.retencion24h >= 80 ? 'gr'
                    : summary.retencion24h >= 60 ? 'am' : 'rd'
              }
              icon={Brain}
              sub={
                summary.primeros
                  ? `${summary.primerosOk}/${summary.primeros} en su primer repaso`
                  : 'ninguna estrenaba repaso'
              }
            />
            <Stat
              label="Aciertos"
              value={`${summary.correct}/${summary.total}`}
              tone={summary.accuracy >= 80 ? 'gr' : 'am'}
              sub={`${summary.accuracy} %`}
              icon={Target}
            />
            <Stat label="Tiempo" value={fmtClock(summary.testMs)} tone="vi" />
            <Stat
              label="Vuelven al principio"
              value={summary.fallos.length}
              unit="palabras"
              tone={summary.fallos.length ? 'rd' : 'gr'}
              icon={RotateCcw}
            />
          </div>

          {summary.retencion24h != null && (
            <Panel className="mt-4">
              <p className="text-xs leading-relaxed text-mute">
                {summary.retencion24h >= 80
                  ? 'Retención sólida. Las imágenes que fabricaste aguantaron un día entero: eso es memorizar de verdad, no cargar y olvidar.'
                  : summary.retencion24h >= 60
                    ? 'Retención mejorable. Las que fallaste tenían imagen débil o demasiado neutra. Al re-anclarlas, exagera más y ponles movimiento.'
                    : 'Retención baja: estás cargando más rápido de lo que puedes fijar. Baja el tamaño del lote y dedica un segundo más a cada imagen; un VRN alto con esta cifra no vale nada.'}
              </p>
            </Panel>
          )}

          {summary.fallos.length > 0 && (
            <Panel className="mt-4">
              <SectionTitle icon={XCircle} right={<Badge tone="rd">{summary.fallos.length}</Badge>}>
                A re-anclar (vuelven mañana)
              </SectionTitle>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {summary.fallos.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-line-soft px-3 py-2 font-mono text-xs"
                  >
                    <XCircle size={13} className="shrink-0 text-rd" />
                    <span className="text-cy">{f.w}</span>
                    <span className="text-mute">→</span>
                    <span className="text-slate-300">{f.m}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Btn tone="gr" size="lg" onClick={() => setPhase('config')}>
              <RotateCcw size={13} className="mr-1.5 inline" /> Volver al repaso · R
            </Btn>
          </div>
        </div>
      </div>
    )
  }

  /* --------- CONFIG --------- */
  const totalPendientes = candidatas.filter((f) => f.vence <= ahora).length
  const consolidadas = candidatas.filter((f) => f.etapa >= ETAPA_CONSOLIDADA).length

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-100">
            Módulo 4 · <span className="text-gr">Repaso espaciado</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Todo lo que memorizas vuelve aquí a las 24 horas, y después a los 3, 7, 21, 60 y 180
            días mientras lo aciertes. Un fallo devuelve la palabra al principio. Esta es la
            diferencia entre cargar rápido y <b className="text-gr">retener</b>: el VRN mide lo
            primero, la retención a 24 h mide lo segundo.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Pendientes ahora" value={totalPendientes} unit="palabras" tone={totalPendientes ? 'am' : 'gr'} icon={CalendarClock} />
          <Stat label="En seguimiento" value={candidatas.length} unit="fichas" icon={Layers} />
          <Stat
            label="Consolidadas"
            value={consolidadas}
            unit="a 21 días o más"
            tone="gr"
            icon={TrendingUp}
          />
        </div>

        {candidatas.length === 0 ? (
          <Panel className="mt-4">
            <EmptyState icon={Brain} title="Todavía no hay nada que repasar">
              Completa un bloque en <b className="text-cy">Memorización</b> (tecla{' '}
              <b className="text-cy">3</b>) y esas palabras entrarán aquí automáticamente. Volverán
              mañana.
            </EmptyState>
          </Panel>
        ) : (
          <>
            <Panel className="mt-4 space-y-5">
              <div>
                <SectionTitle icon={Layers}>Alcance</SectionTitle>
                <Choice
                  value={ambito}
                  onChange={setAmbito}
                  options={[
                    { value: 'todos', label: 'Todos los idiomas' },
                    { value: 'activo', label: `Solo ${deck.name}` },
                  ]}
                />
              </div>
              <div className="font-mono text-[11px] text-mute">
                {cola.length
                  ? `Esta sesión: ${cola.length} palabras (tope diario ${settings.topeRepasoDiario}).`
                  : proximo
                    ? `Nada pendiente. El próximo repaso toca el ${fmtDateTime(proximo)}.`
                    : 'Nada pendiente.'}
              </div>
            </Panel>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Btn tone="gr" size="lg" onClick={start} disabled={!cola.length}>
                <Play size={13} className="mr-1.5 inline" /> Empezar repaso · ENTER
              </Btn>
              {!cola.length && proximo && (
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-mute">
                  <CheckCircle2 size={12} className="text-gr" />
                  Al día. Vuelve el {fmtDateTime(proximo)}.
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
