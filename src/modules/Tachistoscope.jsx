import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Eye, Gauge, CheckCircle2, XCircle, RotateCcw, ChevronsUp, FileText, Languages, Type,
} from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { useKeydown, isTyping, blockScroll } from '../lib/useKeydown.js'
import { shuffle, pick, clamp, orpIndex, round, norm } from '../lib/utils.js'
import { drawIndices } from '../lib/bag.js'
import { RSVP_TEXTS, wordsFromText } from '../data/rsvpTexts.js'
import { sfx } from '../lib/sound.js'
import {
  Panel, Btn, Choice, Kbd, KeyHint, Stat, Progress, Countdown, HintBar, Badge, SectionTitle,
  NumberField, DeckLoading, cx,
} from '../components/ui.jsx'

const PPM_MIN = 300
const PPM_MAX = 900
const PPM_STEP = 25
const BURST_PRESETS = [15, 25, 40, 60]

/**
 * Palabra alineada por su punto óptimo de reconocimiento (ORP): la letra roja
 * queda siempre en el mismo punto de la pantalla para no mover los ojos.
 *
 * El prefijo y el sufijo se anclan al centro, pero desplazados media letra hacia
 * fuera. Sin ese margen se superponían a la letra pivote y la palabra se leía
 * partida, con la letra roja tapada por el resto del texto. La fuente es
 * monoespaciada, así que media letra es exactamente 0.5ch.
 */
function OrpWord({ word }) {
  const i = orpIndex(word)
  return (
    <div className="relative flex w-full items-center justify-center font-mono text-6xl font-bold tracking-tight sm:text-7xl">
      <span
        className="absolute whitespace-pre text-ink"
        style={{ right: 'calc(50% + 0.5ch)' }}
      >
        {word.slice(0, i)}
      </span>
      <span className="text-rd text-glow">{word[i]}</span>
      <span
        className="absolute whitespace-pre text-ink"
        style={{ left: 'calc(50% + 0.5ch)' }}
      >
        {word.slice(i + 1)}
      </span>
    </div>
  )
}

export default function Tachistoscope() {
  const { deck, addSession, setLocked, sessions } = useApp()

  const [phase, setPhase] = useState('config') // config|countdown|burst|probe|done
  const [ppm, setPpm] = useState(350)
  const [burstLen, setBurstLen] = useState(25)
  const [source, setSource] = useState('lang') // lang | text | custom
  const [textId, setTextId] = useState(RSVP_TEXTS[0].id)
  const [customText, setCustomText] = useState('')

  const [stream, setStream] = useState([])
  const [pos, setPos] = useState(0)
  const [probes, setProbes] = useState([])
  const [pi, setPi] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [summary, setSummary] = useState(null)
  const timerRef = useRef(null)
  // Ver nota en Massive: el feedback diferido debe poder cancelarse al abortar.
  const pendingRef = useRef(null)

  const running = phase !== 'config' && phase !== 'done'
  useEffect(() => {
    setLocked(running)
    return () => setLocked(false)
  }, [running, setLocked])

  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
      clearTimeout(pendingRef.current)
    },
    [],
  )

  const maxValidated = useMemo(() => {
    const v = sessions.filter((s) => s.module === 'rsvp' && s.validated).map((s) => s.ppm)
    return v.length ? Math.max(...v) : null
  }, [sessions])

  /* ---------- Fuente de palabras ---------- */

  const pool = useMemo(() => {
    if (source === 'lang') return deck.entries.map((e) => e.w)
    if (source === 'custom') return wordsFromText(customText)
    const t = RSVP_TEXTS.find((x) => x.id === textId) || RSVP_TEXTS[0]
    return wordsFromText(t.body)
  }, [source, deck, customText, textId])

  const poolOk = pool.length >= 8

  /* ---------- Arranque ---------- */

  const start = useCallback(() => {
    if (!poolOk) return
    const n = clamp(burstLen, 5, 200)
    let words = []
    if (source === 'lang') {
      // Bolsa: las ráfagas recorren el mazo entero antes de repetir palabra
      words = drawIndices(`rsvp.${deck.id}`, pool.length, n).map((i) => pool[i])
    } else {
      // Texto corrido: fragmento contiguo para conservar el sentido
      const startAt = Math.max(0, Math.floor(Math.random() * Math.max(1, pool.length - n)))
      words = pool.slice(startAt, startAt + n)
      while (words.length < n) words.push(pick(pool))
    }
    setStream(words)
    setPos(0)
    setProbes([])
    setPi(0)
    setFeedback(null)
    setSummary(null)
    setPhase('countdown')
  }, [poolOk, burstLen, source, pool])

  /* ---------- Ráfaga con corrección de deriva ---------- */

  const beginBurst = useCallback(() => {
    setPhase('burst')
    setPos(0)
    const interval = 60000 / ppm
    const t0 = performance.now()
    let i = 0
    const step = () => {
      i += 1
      if (i >= stream.length) {
        buildProbes()
        return
      }
      setPos(i)
      const drift = performance.now() - t0 - i * interval
      timerRef.current = setTimeout(step, Math.max(8, interval - drift))
    }
    timerRef.current = setTimeout(step, interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppm, stream])

  const buildProbes = useCallback(() => {
    const inBurst = [...new Set(stream)]
    // Set de claves normalizadas: comparar cada palabra del corpus contra cada
    // palabra de la rafaga era O(n*m) y con mazos de miles de entradas se notaba.
    const burstKeys = new Set(inBurst.map(norm))
    const outside = pool.filter((w) => !burstKeys.has(norm(w)))

    // Una comprobacion positiva y otra negativa, en orden aleatorio. Si las dos
    // se sortearan por separado, una de cada cuatro rafagas saldria con las dos
    // positivas y bastaria responder "si" a todo para validar el nivel sin mirar.
    const qs = []
    qs.push({ word: pick(inBurst), appeared: true, given: null, ok: null })
    if (outside.length) {
      qs.push({ word: pick(outside), appeared: false, given: null, ok: null })
    } else {
      // Corpus agotado (la rafaga cubre todo el material): segunda positiva distinta
      const resto = inBurst.filter((w) => w !== qs[0].word)
      qs.push({
        word: resto.length ? pick(resto) : qs[0].word,
        appeared: true,
        given: null,
        ok: null,
      })
    }
    setProbes(shuffle(qs))
    setPi(0)
    setPhase('probe')
    sfx.tick()
  }, [stream, pool])

  /* ---------- Verificación ---------- */

  const answerProbe = useCallback(
    (said) => {
      if (feedback) return
      const q = probes[pi]
      if (!q) return
      const ok = said === q.appeared
      const updated = probes.map((p, n) => (n === pi ? { ...p, given: said, ok } : p))
      setProbes(updated)
      setFeedback(ok ? 'ok' : 'fail')
      ok ? sfx.ok() : sfx.fail()

      pendingRef.current = setTimeout(() => {
        setFeedback(null)
        if (pi + 1 >= updated.length) finish(updated)
        else setPi(pi + 1)
      }, 520)
    },
    [probes, pi, feedback], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const finish = useCallback(
    (finalProbes) => {
      const probesOk = finalProbes.filter((p) => p.ok).length
      const validated = probesOk === finalProbes.length
      const s = {
        ppm,
        words: stream.length,
        source,
        probes: finalProbes.length,
        probesOk,
        validated,
        durationMs: round((stream.length * 60000) / ppm, 0),
        detail: finalProbes.map((p) => ({ word: p.word, appeared: p.appeared, given: p.given, ok: p.ok })),
      }
      setSummary(s)
      addSession({ module: 'rsvp', lang: deck.id, langName: deck.name, ...s })
      setPhase('done')
      validated ? sfx.finish() : sfx.fail()
    },
    [ppm, stream.length, source, addSession, deck],
  )

  const levelUp = useCallback(() => {
    setPpm((p) => clamp(p + PPM_STEP, PPM_MIN, PPM_MAX))
    setPhase('config')
  }, [])

  /* ---------- Teclado ---------- */

  useKeydown((e) => {
    if (phase === 'config') {
      if (isTyping(e)) return
      if (e.key === 'Enter') { e.preventDefault(); start() }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setPpm((p) => clamp(p + PPM_STEP, PPM_MIN, PPM_MAX)) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setPpm((p) => clamp(p - PPM_STEP, PPM_MIN, PPM_MAX)) }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      clearTimeout(timerRef.current)
      clearTimeout(pendingRef.current)
      setFeedback(null)
      setPhase('config')
      return
    }
    if (phase === 'probe') {
      blockScroll(e)
      const k = e.key.toLowerCase()
      if (k === 's' || e.key === 'ArrowRight') answerProbe(true)
      else if (k === 'n' || e.key === 'ArrowLeft') answerProbe(false)
      return
    }
    if (phase === 'done') {
      const k = e.key.toLowerCase()
      if (k === 'r') { e.preventDefault(); start() }
      if (k === '+' && summary?.validated) { e.preventDefault(); levelUp() }
    }
  })

  const wpsMs = round(60000 / ppm, 1)

  /* ======================= RENDER ======================= */

  if (deck.loading) return <DeckLoading name={deck.name} />

  if (phase === 'countdown') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Countdown from={3} onDone={beginBurst} label={`RÁFAGA A ${ppm} PPM · FIJA LA VISTA`} />
      </div>
    )
  }

  if (phase === 'burst') {
    const w = stream[pos] || ''
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <Badge tone="rd">
            <Eye size={11} /> {ppm} PPM · {wpsMs} ms/palabra
          </Badge>
          <span className="font-mono text-[11px] text-mute">
            {pos + 1} / {stream.length}
          </span>
        </div>
        <div className="px-6 pt-3">
          <Progress value={pos + 1} max={stream.length} tone="am" />
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {/* Guías de fijación */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-px -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-rd/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-rd/40 to-transparent" />
          </div>
          <div className="w-full px-6">
            <OrpWord word={w} />
          </div>
        </div>

        <HintBar>
          <KeyHint keys={['ESC']} label="abortar ráfaga" />
          <span className="font-mono text-[11px] text-mute">no subvocalices · solo captura</span>
        </HintBar>
      </div>
    )
  }

  if (phase === 'probe') {
    const q = probes[pi]
    if (!q) return null
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <Badge tone="vi">
            COMPROBACIÓN FLASH {pi + 1} / {probes.length}
          </Badge>
          <span className="font-mono text-[11px] text-mute">{ppm} PPM</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-mute">
            ¿apareció esta palabra en la ráfaga?
          </span>
          <div
            key={pi}
            className={cx(
              'anim-pop rounded-2xl border px-10 py-6 font-mono text-5xl font-bold',
              feedback === 'ok'
                ? 'border-gr/60 text-gr glow-gr'
                : feedback === 'fail'
                  ? 'border-rd/60 text-rd glow-rd'
                  : 'border-line text-ink',
            )}
          >
            {q.word}
          </div>

          {feedback ? (
            <div className="anim-in font-mono text-sm">
              {feedback === 'ok' ? (
                <span className="text-gr">CORRECTO</span>
              ) : (
                <span className="text-rd">
                  FALLO · {q.appeared ? 'sí apareció' : 'no apareció'}
                </span>
              )}
            </div>
          ) : (
            <div className="flex gap-4">
              <Btn tone="gr" size="lg" onClick={() => answerProbe(true)}>
                SÍ · S
              </Btn>
              <Btn tone="rd" size="lg" onClick={() => answerProbe(false)}>
                NO · N
              </Btn>
            </div>
          )}
        </div>

        <HintBar>
          <KeyHint keys={['S', '→']} label="sí apareció" tone="gr" />
          <KeyHint keys={['N', '←']} label="no apareció" tone="rd" />
        </HintBar>
      </div>
    )
  }

  if (phase === 'done' && summary) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <SectionTitle
            icon={Eye}
            right={
              summary.validated ? (
                <Badge tone="gr">NIVEL VALIDADO</Badge>
              ) : (
                <Badge tone="rd">NIVEL NO VALIDADO</Badge>
              )
            }
          >
            Procesamiento visual a {summary.ppm} PPM
          </SectionTitle>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Velocidad probada" value={summary.ppm} unit="ppm" icon={Gauge} tone="am" />
            <Stat
              label="Comprobaciones"
              value={`${summary.probesOk}/${summary.probes}`}
              tone={summary.validated ? 'gr' : 'rd'}
              icon={summary.validated ? CheckCircle2 : XCircle}
            />
            <Stat label="Palabras captadas" value={summary.words} unit="pal" />
            <Stat
              label="Récord validado"
              value={maxValidated ?? '--'}
              unit="ppm"
              tone="vi"
              icon={ChevronsUp}
            />
          </div>

          <Panel className="mt-4">
            <SectionTitle>Detalle de la comprobación</SectionTitle>
            <div className="space-y-1.5">
              {summary.detail.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-line-soft px-3 py-2 font-mono text-xs"
                >
                  {d.ok ? (
                    <CheckCircle2 size={14} className="shrink-0 text-gr" />
                  ) : (
                    <XCircle size={14} className="shrink-0 text-rd" />
                  )}
                  <span className="text-ink">{d.word}</span>
                  <span className="ml-auto text-mute">
                    dijiste <b className={d.ok ? 'text-gr' : 'text-rd'}>{d.given ? 'SÍ' : 'NO'}</b>
                    {' · '}realidad{' '}
                    <b className="text-ink-2">{d.appeared ? 'SÍ apareció' : 'NO apareció'}</b>
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          {summary.validated && summary.ppm >= PPM_MAX ? (
            <Panel className="mt-4 border-gr/30">
              <div className="font-mono text-sm font-bold text-gr">
                Techo de la escala alcanzado: {PPM_MAX} PPM validados.
              </div>
              <p className="mt-1 text-xs text-mute">
                A partir de aquí ya no se gana subiendo el contador. Alarga la ráfaga y sube la
                densidad del material: textos propios en vez de vocabulario suelto.
              </p>
            </Panel>
          ) : summary.validated ? (
            <Panel className="mt-4 border-gr/30">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-sm font-bold text-gr">
                    Nivel superado. Puedes subir el listón.
                  </div>
                  <p className="mt-1 text-xs text-mute">
                    Siguiente escalón: {clamp(summary.ppm + PPM_STEP, PPM_MIN, PPM_MAX)} PPM
                    ({round(60000 / clamp(summary.ppm + PPM_STEP, PPM_MIN, PPM_MAX), 1)} ms por palabra).
                  </p>
                </div>
                <Btn tone="gr" size="lg" onClick={levelUp}>
                  <ChevronsUp size={13} className="mr-1.5 inline" /> Subir a{' '}
                  {clamp(summary.ppm + PPM_STEP, PPM_MIN, PPM_MAX)} PPM · +
                </Btn>
              </div>
            </Panel>
          ) : (
            <Panel className="mt-4 border-rd/25">
              <div className="font-mono text-sm font-bold text-rd">Nivel no consolidado.</div>
              <p className="mt-1 text-xs text-mute">
                Repite a {summary.ppm} PPM hasta acertar las dos comprobaciones seguidas antes de
                subir. Si fallas repetidamente, baja un escalón: la velocidad sin captura no es
                lectura, es pasar diapositivas.
              </p>
            </Panel>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Btn tone="cy" size="lg" onClick={start}>
              <RotateCcw size={13} className="mr-1.5 inline" /> Repetir ráfaga · R
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
          <h1 className="font-mono text-2xl font-bold tracking-tight text-ink">
            Módulo 3 · <span className="text-cy">Taquistoscopio / RSVP</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Ráfagas de palabras en un punto fijo para forzar la captura visual sin subvocalizar. La
            letra roja marca el punto óptimo de reconocimiento: fija la mirada ahí y no muevas los
            ojos. Al final hay comprobaciones flash; solo si las aciertas se valida el nivel y se
            desbloquea la subida de PPM.
          </p>
        </div>

        <Panel className="space-y-6">
          <div>
            <SectionTitle icon={Gauge} right={<Badge tone="am">{wpsMs} ms por palabra</Badge>}>
              Velocidad objetivo
            </SectionTitle>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={PPM_MIN}
                max={PPM_MAX}
                step={PPM_STEP}
                value={ppm}
                onChange={(e) => setPpm(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-cy"
              />
              <div className="font-mono text-3xl font-bold tabular-nums text-cy text-glow">
                {ppm}
              </div>
              <span className="font-mono text-[10px] uppercase text-mute">ppm</span>
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-mute">
              <span>300 · lectura rápida</span>
              <span>600 · umbral atleta</span>
              <span>900 · captura pura</span>
            </div>
            {maxValidated && (
              <p className="mt-2 font-mono text-[11px] text-vi">
                récord validado: {maxValidated} PPM
              </p>
            )}
          </div>

          <div>
            <SectionTitle icon={Type}>Longitud de la ráfaga</SectionTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Choice
                options={BURST_PRESETS.map((b) => ({ value: b, label: `${b}` }))}
                value={burstLen}
                onChange={setBurstLen}
              />
              <NumberField
                value={burstLen}
                onChange={(v) => setBurstLen(clamp(v || 5, 5, 200))}
                min={5}
                max={200}
                suffix="palabras"
              />
              <span className="font-mono text-[11px] text-mute">
                ≈ {round((burstLen * 60) / ppm, 1)} s de ráfaga
              </span>
            </div>
          </div>

          <div>
            <SectionTitle icon={Languages}>Material</SectionTitle>
            <Choice
              value={source}
              onChange={setSource}
              options={[
                { value: 'lang', label: `Vocabulario · ${deck.tag}` },
                { value: 'text', label: 'Texto en español' },
                { value: 'custom', label: 'Texto propio' },
              ]}
            />
            {source === 'text' && (
              <div className="mt-3">
                <Choice
                  value={textId}
                  onChange={setTextId}
                  options={RSVP_TEXTS.map((t) => ({ value: t.id, label: t.title }))}
                />
              </div>
            )}
            {source === 'custom' && (
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Pega aquí cualquier texto para entrenar sobre él..."
                rows={5}
                className="mt-3 w-full rounded-xl border border-line bg-ink-950/60 p-3 font-mono text-xs text-ink-2 placeholder:text-ink-4 focus:border-cy/50"
              />
            )}
            <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-mute">
              <FileText size={11} />
              {pool.length} palabras disponibles
              {!poolOk && <span className="text-rd">· necesitas al menos 8</span>}
            </p>
          </div>
        </Panel>

        <div className="mt-5 flex items-center gap-3">
          <Btn tone="cy" size="lg" onClick={start} disabled={!poolOk}>
            Lanzar ráfaga · ENTER
          </Btn>
          <KeyHint keys={['↑', '↓']} label="ajustar PPM" />
        </div>
      </div>
    </div>
  )
}
