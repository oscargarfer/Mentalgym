import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Zap, Timer, Target, CheckCircle2, XCircle, RotateCcw, ArrowRight } from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { useKeydown, isTyping, blockScroll } from '../lib/useKeydown.js'
import {
  shuffle, mean, fmtMs, clamp, answerMatchesAny, buildMeaningIndex, norm, round,
} from '../lib/utils.js'
import { drawIndices } from '../lib/bag.js'
import { WARMUP_NOUNS } from '../data/warmupBank.js'
import { sfx } from '../lib/sound.js'
import {
  Panel, Btn, Choice, Kbd, KeyHint, Stat, Progress, Countdown, HintBar, Badge, SectionTitle,
  NumberField, DeckLoading,
} from '../components/ui.jsx'

const ROUND_PRESETS = [10, 20, 30, 50]

export default function Warmup() {
  const { deck, addSession, setLocked } = useApp()

  const [phase, setPhase] = useState('config') // config | countdown | run | recall | done
  const [rounds, setRounds] = useState(20)
  const [source, setSource] = useState('random') // random | lang

  const [pairs, setPairs] = useState([])
  const [idx, setIdx] = useState(0)
  const [times, setTimes] = useState([])
  const shownAt = useRef(0)
  const [lastMs, setLastMs] = useState(null)

  const [quiz, setQuiz] = useState([])
  const [qi, setQi] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState(null) // 'ok' | 'fail'
  const [summary, setSummary] = useState(null)
  // Ver nota en Massive: hay que poder cancelar el feedback diferido al abortar,
  // o una sesion abandonada acaba registrada en el historico.
  const pendingRef = useRef(null)
  const inputRef = useRef(null)

  const running = phase !== 'config' && phase !== 'done'
  const meaningIndex = useMemo(() => buildMeaningIndex(deck.entries), [deck.entries])

  // Cada pareja consume dos palabras distintas, así que el tope real es la mitad
  // del banco. Por encima habría que repetir alguna dentro del mismo bloque.
  const bankSize = source === 'lang' ? deck.entries.length : WARMUP_NOUNS.length
  const maxRounds = source === 'lang' ? Math.min(300, bankSize) : Math.floor(bankSize / 2)

  useEffect(() => {
    setRounds((r) => clamp(r, 1, maxRounds))
  }, [maxRounds])
  useEffect(() => {
    setLocked(running)
    return () => setLocked(false)
  }, [running, setLocked])

  useEffect(() => () => clearTimeout(pendingRef.current), [])

  /* ---------- Construccion del bloque ---------- */

  // Se extrae de una bolsa (sin reemplazo, con memoria entre sesiones) en vez de
  // sortear cada palabra suelta: ninguna palabra puede aparecer dos veces en el
  // mismo bloque, y no vuelve a salir hasta agotar el resto del banco.
  const buildPairs = useCallback(() => {
    const out = []
    if (source === 'lang' && deck.entries.length >= 2) {
      const idx = drawIndices(`warmup.lang.${deck.id}`, deck.entries.length, rounds)
      for (const i of idx) {
        const e = deck.entries[i]
        out.push({ a: e.w, b: e.m, note: e.r || '', kind: 'lang' })
      }
    } else {
      // Dos palabras distintas por pareja: se piden 2×rondas de una tacada
      const idx = drawIndices('warmup.nouns', WARMUP_NOUNS.length, rounds * 2)
      for (let i = 0; i < rounds; i++) {
        out.push({
          a: WARMUP_NOUNS[idx[i * 2]],
          b: WARMUP_NOUNS[idx[i * 2 + 1]],
          note: '',
          kind: 'random',
        })
      }
    }
    return out
  }, [source, deck, rounds])

  const start = useCallback(() => {
    setPairs(buildPairs())
    setIdx(0)
    setTimes([])
    setLastMs(null)
    setQuiz([])
    setQi(0)
    setInput('')
    setSummary(null)
    setFeedback(null)
    setPhase('countdown')
  }, [buildPairs])

  const beginRun = useCallback(() => {
    setPhase('run')
    shownAt.current = performance.now()
    sfx.start()
  }, [])

  /* ---------- Fase RUN: enganche con ESPACIO ---------- */

  const hook = useCallback(() => {
    const now = performance.now()
    const dt = now - shownAt.current
    setLastMs(dt)
    setTimes((t) => [...t, dt])
    sfx.hook()

    const next = idx + 1
    if (next >= pairs.length) {
      // Mini-test de evocacion aleatorio sobre el bloque recien hecho
      const k = clamp(Math.round(pairs.length * 0.25), 3, 8)
      const chosen = shuffle(pairs).slice(0, k)
      setQuiz(
        chosen.map((p) => ({
          ...p,
          ask: Math.random() < 0.5 ? 'a' : 'b',
          given: '',
          ok: null,
        })),
      )
      setIdx(next)
      setPhase('recall')
    } else {
      shownAt.current = performance.now()
      setIdx(next)
    }
  }, [idx, pairs])

  /* ---------- Fase RECALL ---------- */

  const submitRecall = useCallback(() => {
    const q = quiz[qi]
    if (!q) return
    // Si se pregunta por la palabra extranjera valen tambien su lectura y, en
    // pares de vocabulario, cualquier sinonimo del mazo con ese significado.
    const expected =
      q.ask === 'a'
        ? [q.b]
        : [q.a, q.note, ...(q.kind === 'lang' ? meaningIndex.get(norm(q.b)) || [] : [])]
    const ok = answerMatchesAny(input, expected)
    setFeedback(ok ? 'ok' : 'fail')
    ok ? sfx.ok() : sfx.fail()

    const updated = quiz.map((item, n) => (n === qi ? { ...item, given: input, ok } : item))
    setQuiz(updated)

    pendingRef.current = setTimeout(() => {
      setFeedback(null)
      setInput('')
      if (qi + 1 >= updated.length) finish(updated)
      else setQi(qi + 1)
    }, 480)
  }, [quiz, qi, input, meaningIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(
    (finalQuiz) => {
      const correct = finalQuiz.filter((q) => q.ok).length
      const recallPct = finalQuiz.length ? (correct / finalQuiz.length) * 100 : 0
      const avgMs = mean(times)
      const s = {
        rounds: pairs.length,
        source,
        avgMs: round(avgMs, 0),
        bestMs: round(Math.min(...times), 0),
        worstMs: round(Math.max(...times), 0),
        recallPct: round(recallPct, 1),
        quizTotal: finalQuiz.length,
        quizCorrect: correct,
        quiz: finalQuiz.map((q) => ({
          a: q.a, b: q.b, ask: q.ask, given: q.given, ok: q.ok,
        })),
      }
      setSummary(s)
      addSession({ module: 'warmup', lang: deck.id, langName: deck.name, ...s })
      setPhase('done')
      sfx.finish()
    },
    [times, pairs.length, source, addSession, deck],
  )

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
    if (phase === 'run') {
      blockScroll(e)
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') hook()
      return
    }
    if (phase === 'recall') {
      if (e.key === 'Enter' && !feedback) { e.preventDefault(); submitRecall() }
      return
    }
    if (phase === 'done') {
      if (e.key.toLowerCase() === 'r') { e.preventDefault(); start() }
    }
  })

  useEffect(() => {
    if (phase === 'recall' && !feedback) inputRef.current?.focus()
  }, [phase, qi, feedback])

  const liveAvg = useMemo(() => (times.length ? mean(times) : null), [times])

  /* ======================= RENDER ======================= */

  if (deck.loading) return <DeckLoading name={deck.name} />

  if (phase === 'countdown') {
    return (
      <Stage>
        <Countdown from={3} onDone={beginRun} label="CALENTAMIENTO · ASOCIACIÓN FLASH" />
      </Stage>
    )
  }

  if (phase === 'run') {
    const p = pairs[idx]
    if (!p) return null
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <Badge tone="cy">
            <Zap size={11} /> RONDA {String(idx + 1).padStart(2, '0')} / {pairs.length}
          </Badge>
          <div className="flex items-center gap-4 font-mono text-[11px] text-mute">
            <span>ÚLTIMA <b className="text-cy">{fmtMs(lastMs)}</b></span>
            <span>MEDIA <b className="text-cy">{fmtMs(liveAvg)}</b></span>
          </div>
        </div>
        <div className="px-6 pt-3">
          <Progress value={idx} max={pairs.length} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-mute">
            engancha la imagen mental
          </span>
          <div key={idx} className="anim-pop flex flex-col items-center gap-5 text-center">
            <div className="font-mono text-4xl font-bold tracking-tight text-slate-100 sm:text-6xl">
              {p.a}
            </div>
            <div className="flex items-center gap-3">
              <span className="h-px w-12 bg-line" />
              <span className="font-mono text-lg text-cy text-glow">+</span>
              <span className="h-px w-12 bg-line" />
            </div>
            <div className="font-mono text-4xl font-bold tracking-tight text-slate-100 sm:text-6xl">
              {p.b}
            </div>
            {p.note && <div className="font-mono text-xs text-mute">{p.note}</div>}
          </div>
          <div className="h-2 w-2 rounded-full bg-cy anim-pulse-ring" />
        </div>

        <HintBar>
          <KeyHint keys={['ESPACIO']} label="he enganchado · siguiente" tone="cy" />
          <KeyHint keys={['ESC']} label="abortar bloque" />
        </HintBar>
      </div>
    )
  }

  if (phase === 'recall') {
    const q = quiz[qi]
    if (!q) return null
    const shown = q.ask === 'a' ? q.a : q.b
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <Badge tone="vi">
            <Target size={11} /> MINI-TEST DE EVOCACIÓN {qi + 1} / {quiz.length}
          </Badge>
          <span className="font-mono text-[11px] text-mute">¿la asociación era real?</span>
        </div>
        <div className="px-6 pt-3">
          <Progress value={qi} max={quiz.length} tone="vi" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-mute">
            ¿con qué estaba enganchada?
          </span>
          <div key={qi} className="anim-pop font-mono text-5xl font-bold text-vi text-glow">
            {shown}
          </div>
          <input
            ref={inputRef}
            value={input}
            disabled={!!feedback}
            onChange={(e) => setInput(e.target.value)}
            placeholder="escribe la pareja..."
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            enterKeyHint="done"
            className={`w-full max-w-lg rounded-xl border bg-ink-900/60 px-5 py-4 text-center font-mono text-2xl text-slate-100 transition-colors placeholder:text-slate-700 ${
              feedback === 'ok'
                ? 'border-gr/70 glow-gr'
                : feedback === 'fail'
                  ? 'border-rd/70 glow-rd'
                  : 'border-line focus:border-vi/60'
            }`}
          />
          {feedback === 'fail' && (
            <div className="anim-in font-mono text-sm text-rd">
              era → <b>{q.ask === 'a' ? q.b : q.a}</b>
            </div>
          )}
        </div>

        <HintBar>
          <KeyHint keys={['ENTER']} label="confirmar" tone="vi" />
          <KeyHint keys={['ESC']} label="salir" />
        </HintBar>
      </div>
    )
  }

  if (phase === 'done' && summary) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <SectionTitle icon={Zap} right={<Badge tone="gr">BLOQUE COMPLETADO</Badge>}>
            Resultado del calentamiento
          </SectionTitle>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Reacción media" value={Math.round(summary.avgMs)} unit="ms" icon={Timer} />
            <Stat label="Mejor enganche" value={Math.round(summary.bestMs)} unit="ms" tone="gr" icon={Zap} />
            <Stat label="Más lento" value={Math.round(summary.worstMs)} unit="ms" tone="am" />
            <Stat
              label="Evocación real"
              value={`${summary.recallPct}`}
              unit="%"
              tone={summary.recallPct >= 80 ? 'gr' : summary.recallPct >= 50 ? 'am' : 'rd'}
              sub={`${summary.quizCorrect}/${summary.quizTotal} asociaciones verificadas`}
              icon={Target}
            />
          </div>

          <Panel className="mt-4">
            <SectionTitle icon={Target}>Auditoría del mini-test</SectionTitle>
            <div className="space-y-1.5">
              {summary.quiz.map((q, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-line-soft px-3 py-2 font-mono text-xs"
                >
                  {q.ok ? (
                    <CheckCircle2 size={14} className="shrink-0 text-gr" />
                  ) : (
                    <XCircle size={14} className="shrink-0 text-rd" />
                  )}
                  <span className="text-slate-300">{q.ask === 'a' ? q.a : q.b}</span>
                  <ArrowRight size={12} className="text-line" />
                  <span className={q.ok ? 'text-gr' : 'text-rd line-through'}>
                    {q.given || '(sin respuesta)'}
                  </span>
                  {!q.ok && (
                    <span className="ml-auto text-mute">
                      correcto: <b className="text-slate-300">{q.ask === 'a' ? q.b : q.a}</b>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Btn tone="cy" size="lg" onClick={start}>
              <RotateCcw size={13} className="mr-1.5 inline" /> Repetir bloque · R
            </Btn>
            <Btn tone="mute" onClick={() => setPhase('config')}>
              Cambiar configuración
            </Btn>
          </div>

          <p className="mt-5 max-w-2xl text-xs leading-relaxed text-mute">
            Objetivo del calentamiento: bajar de <b className="text-cy">1500 ms</b> por enganche
            manteniendo la evocación por encima del <b className="text-cy">80 %</b>. Si la reacción
            baja pero la evocación cae, estás pulsando sin crear imagen real.
          </p>
        </div>
      </div>
    )
  }

  /* ---------- CONFIG ---------- */

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-100">
            Módulo 1 · <span className="text-cy">Asociación Flash</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Calentamiento de velocidad de enganche. Aparece una pareja de palabras: fabrica la
            imagen mental que las une (absurda, en movimiento, exagerada) y pulsa{' '}
            <Kbd>ESPACIO</Kbd> en el instante exacto en que la ves. Las rondas encadenan sin
            interrupciones. Al final, un mini-test aleatorio comprueba que las asociaciones eran
            reales y no un reflejo del dedo.
          </p>
        </div>

        <Panel className="space-y-6">
          <div>
            <SectionTitle icon={Timer}>Rondas del bloque</SectionTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Choice
                options={ROUND_PRESETS.map((r) => ({ value: r, label: `${r}` }))}
                value={ROUND_PRESETS.includes(rounds) ? rounds : null}
                onChange={setRounds}
              />
              <NumberField
                value={rounds}
                onChange={(v) => setRounds(clamp(v || 1, 1, maxRounds))}
                min={1}
                max={maxRounds}
                suffix="parejas"
              />
            </div>
          </div>

          <div>
            <SectionTitle icon={Zap}>Material de asociación</SectionTitle>
            <Choice
              value={source}
              onChange={setSource}
              options={[
                { value: 'random', label: 'Sustantivos aleatorios' },
                { value: 'lang', label: `Vocabulario · ${deck.name}` },
              ]}
            />
            <p className="mt-2 text-xs leading-relaxed text-mute">
              {source === 'random'
                ? `Pares de palabras concretas sin relación previa: entrenamiento puro de enganche. Banco de ${bankSize} sustantivos.`
                : `Pares palabra extranjera + significado del mazo activo (${bankSize} entradas).`}
              <br />
              Se reparten sin reemplazo: ninguna palabra se repite dentro de un bloque, y no
              vuelve a salir hasta que hayan salido todas las demás.
            </p>
          </div>
        </Panel>

        <div className="mt-5 flex items-center gap-3">
          <Btn tone="cy" size="lg" onClick={start}>
            Iniciar calentamiento · ENTER
          </Btn>
          <span className="font-mono text-[11px] text-mute">
            {rounds} parejas · mini-test de {clamp(Math.round(rounds * 0.25), 3, 8)} preguntas
          </span>
        </div>
      </div>
    </div>
  )
}

function Stage({ children }) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>
}
