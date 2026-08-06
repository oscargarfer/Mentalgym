import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Landmark, Target, RotateCcw, Play, Plus, Trash2, Pencil, ArrowRight, ArrowLeft, Timer, XCircle,
} from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { useKeydown, isTyping, blockScroll } from '../lib/useKeydown.js'
import { clamp, round, fmtClock, norm } from '../lib/utils.js'
import { drawIndices } from '../lib/bag.js'
import { WARMUP_NOUNS } from '../data/warmupBank.js'
import { sfx } from '../lib/sound.js'
import {
  Panel, Btn, Choice, Kbd, KeyHint, Stat, Progress, Countdown, HintBar, Badge, SectionTitle,
  EmptyState, cx,
} from '../components/ui.jsx'

/**
 * Palacio de la memoria: almacenamiento ORDENADO.
 *
 * Los otros módulos evocan en desorden, y eso deja sin entrenar la recuperación
 * secuencial, que es una destreza distinta y más dura. Aquí se recorre un
 * itinerario conocido —tu casa, tu calle— colocando un dato en cada punto, y
 * después se reconstruye la secuencia entera. El recorrido inverso obliga a que
 * las imágenes estén realmente ancladas y no encadenadas por inercia.
 */
export default function Palace() {
  const { palaces, addPalace, updatePalace, removePalace, deck, pegs, addSession, setLocked } = useApp()

  const [phase, setPhase] = useState('config') // config | editor | countdown | load | recall | done
  const [palacioId, setPalacioId] = useState(palaces[0]?.id || null)
  const [fuente, setFuente] = useState('nouns') // nouns | lang | numeros | propia
  const [propia, setPropia] = useState('')
  const [sentido, setSentido] = useState('directo') // directo | inverso
  const [cantidad, setCantidad] = useState(10)

  const [items, setItems] = useState([]) // [{ locus, item, clave }]
  const [idx, setIdx] = useState(0)
  const loadStart = useRef(0)
  const [loadMs, setLoadMs] = useState(0)
  const [ri, setRi] = useState(0)
  const [input, setInput] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [summary, setSummary] = useState(null)
  const respRef = useRef([])
  const pendingRef = useRef(null)
  const inputRef = useRef(null)

  // Editor
  const [editId, setEditId] = useState(null)
  const [nombre, setNombre] = useState('')
  const [lociTexto, setLociTexto] = useState('')

  const palacio = useMemo(() => palaces.find((p) => p.id === palacioId) || palaces[0], [palaces, palacioId])
  const running = phase !== 'config' && phase !== 'done' && phase !== 'editor'

  useEffect(() => {
    setLocked(running)
    return () => setLocked(false)
  }, [running, setLocked])
  useEffect(() => () => clearTimeout(pendingRef.current), [])

  const maxItems = palacio?.loci.length || 0
  useEffect(() => {
    if (maxItems) setCantidad((c) => clamp(c, 3, maxItems))
  }, [maxItems])

  /* ---------- Material a colocar ---------- */

  const generarItems = useCallback(
    (n) => {
      if (fuente === 'lang' && deck.entries.length >= n) {
        return drawIndices(`palace.lang.${deck.id}`, deck.entries.length, n).map((i) => {
          const e = deck.entries[i]
          return { item: e.w, clave: e.w, pista: e.m }
        })
      }
      if (fuente === 'numeros') {
        return drawIndices('palace.numeros', 100, n).map((v) => ({
          item: pegs[v],
          clave: String(v).padStart(2, '0'),
          pista: `casilla ${String(v).padStart(2, '0')}`,
        }))
      }
      if (fuente === 'propia') {
        const lista = propia.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)
        return lista.slice(0, n).map((t) => ({ item: t, clave: t, pista: '' }))
      }
      return drawIndices('palace.nouns', WARMUP_NOUNS.length, n).map((i) => ({
        item: WARMUP_NOUNS[i],
        clave: WARMUP_NOUNS[i],
        pista: '',
      }))
    },
    [fuente, deck, pegs, propia],
  )

  const disponiblesPropia = propia.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).length

  /* ---------- Sesión ---------- */

  const start = useCallback(() => {
    if (!palacio || palacio.loci.length < 3) return
    const n = clamp(cantidad, 3, palacio.loci.length)
    const material = generarItems(n)
    if (material.length < n) return
    setItems(palacio.loci.slice(0, n).map((locus, i) => ({ locus, ...material[i] })))
    setIdx(0)
    setRi(0)
    setInput('')
    setFeedback(null)
    setSummary(null)
    setLoadMs(0)
    respRef.current = []
    setPhase('countdown')
  }, [palacio, cantidad, generarItems])

  const beginLoad = useCallback(() => {
    loadStart.current = performance.now()
    setPhase('load')
    sfx.start()
  }, [])

  const endLoad = useCallback(() => {
    setLoadMs(performance.now() - loadStart.current)
    setRi(0)
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

  // El recorrido inverso pregunta los loci del final al principio
  const ordenRecall = useMemo(
    () => (sentido === 'inverso' ? [...items].reverse() : items),
    [items, sentido],
  )

  const finish = useCallback(
    (res) => {
      let intacta = 0
      let seguimos = true
      for (const r of res) {
        if (seguimos && r.ok) intacta++
        else seguimos = false
      }
      const correctos = res.filter((r) => r.ok).length
      const s = {
        palacio: palacio.nombre,
        fuente,
        sentido,
        total: res.length,
        correctos,
        intacta,
        accuracy: res.length ? round((correctos / res.length) * 100, 1) : 0,
        loadMs: round(loadMs, 0),
        msPorLocus: res.length ? round(loadMs / res.length, 0) : 0,
        fallos: res.filter((r) => !r.ok).map((r) => ({ locus: r.locus, esperado: r.clave, dado: r.given })),
      }
      setSummary(s)
      addSession({ module: 'palace', ...s })
      setPhase('done')
      sfx.finish()
    },
    [palacio, fuente, sentido, loadMs, addSession],
  )

  const submit = useCallback(() => {
    const it = ordenRecall[ri]
    if (!it) return
    const ok = norm(input) === norm(it.clave)
    const res = [...respRef.current, { ...it, ok, given: input.trim() }]
    respRef.current = res
    setFeedback(ok ? 'ok' : 'fail')
    ok ? sfx.ok() : sfx.fail()
    pendingRef.current = setTimeout(
      () => {
        setFeedback(null)
        setInput('')
        if (ri + 1 >= ordenRecall.length) finish(res)
        else setRi(ri + 1)
      },
      ok ? 260 : 750,
    )
  }, [ordenRecall, ri, input, finish])

  useEffect(() => {
    if (phase === 'recall' && !feedback) inputRef.current?.focus()
  }, [phase, ri, feedback])

  /* ---------- Editor ---------- */

  const abrirEditor = (p) => {
    setEditId(p?.id || null)
    setNombre(p?.nombre || '')
    setLociTexto((p?.loci || []).join('\n'))
    setPhase('editor')
  }

  const guardarPalacio = () => {
    const loci = lociTexto.split('\n').map((s) => s.trim()).filter(Boolean)
    if (loci.length < 3) return
    if (editId) updatePalace(editId, { nombre: nombre.trim() || 'Palacio', loci })
    else setPalacioId(addPalace(nombre.trim() || 'Palacio', loci))
    setPhase('config')
  }

  /* ---------- Teclado ---------- */

  useKeydown((e) => {
    if (phase === 'config') {
      if (e.key === 'Enter' && !isTyping(e)) { e.preventDefault(); start() }
      return
    }
    if (phase === 'editor') {
      if (e.key === 'Escape') { e.preventDefault(); setPhase('config') }
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
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') nextItem()
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
      return
    }
    if (phase === 'recall' && e.key === 'Enter' && !feedback) { e.preventDefault(); submit() }
    if (phase === 'done' && e.key.toLowerCase() === 'r') { e.preventDefault(); start() }
  })

  /* ======================= RENDER ======================= */

  if (phase === 'editor') {
    const loci = lociTexto.split('\n').map((s) => s.trim()).filter(Boolean)
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          <SectionTitle icon={Landmark} right={<Badge tone={loci.length >= 3 ? 'gr' : 'rd'}>{loci.length} puntos</Badge>}>
            {editId ? 'Editar palacio' : 'Nuevo palacio'}
          </SectionTitle>
          <Panel className="space-y-4">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre (ej. Mi casa, El camino al trabajo)"
              className="w-full rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-700 focus:border-cy/50"
            />
            <div>
              <p className="mb-2 text-xs leading-relaxed text-mute">
                Un punto por línea, <b className="text-slate-300">en el orden exacto en que los
                recorres</b>. Tienen que ser sitios que conozcas de memoria y que puedas recorrer
                siempre igual: la puerta, el perchero, el espejo, el sofá… Mínimo 3, ideal 10-20.
              </p>
              <textarea
                value={lociTexto}
                onChange={(e) => setLociTexto(e.target.value)}
                rows={12}
                spellCheck={false}
                placeholder={'puerta de entrada\nperchero\nespejo del recibidor\nsofá\ntelevisor\nventana\n…'}
                className="w-full rounded-xl border border-line bg-ink-950/60 p-3 font-mono text-sm text-slate-300 placeholder:text-slate-700 focus:border-cy/50"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Btn tone="gr" onClick={guardarPalacio} disabled={loci.length < 3}>
                Guardar palacio
              </Btn>
              <Btn tone="mute" onClick={() => setPhase('config')}>Cancelar · ESC</Btn>
              {loci.length < 3 && <span className="font-mono text-[11px] text-rd">hacen falta al menos 3 puntos</span>}
            </div>
          </Panel>
        </div>
      </div>
    )
  }

  if (phase === 'countdown') {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Countdown from={3} onDone={beginLoad} label={`RECORRIENDO · ${palacio?.nombre || ''}`} />
      </div>
    )
  }

  if (phase === 'load') {
    const it = items[idx]
    if (!it) return null
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <Badge tone="vi"><Landmark size={11} /> PUNTO {idx + 1} / {items.length}</Badge>
          <span className="font-mono text-[11px] text-mute">coloca el objeto en el sitio</span>
        </div>
        <div className="px-6 pt-3"><Progress value={idx + 1} max={items.length} tone="vi" /></div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6">
          <div key={idx} className="anim-pop flex flex-col items-center gap-5 text-center">
            {/* Sin transformar la caja: el punto debe verse igual al colocar
                que al evocarlo, o parecen dos etiquetas distintas. */}
            <div className="font-mono text-lg tracking-[0.2em] text-vi">{it.locus}</div>
            <div className="h-px w-24 bg-line" />
            <div className="font-mono text-5xl font-bold text-slate-100 sm:text-6xl">{it.item}</div>
            {it.pista && <div className="font-mono text-sm text-mute">{it.pista}</div>}
          </div>
        </div>

        <HintBar>
          <KeyHint keys={['ESPACIO', '→']} label="siguiente punto" tone="vi" />
          <KeyHint keys={['←']} label="anterior" />
          <KeyHint keys={['ESC']} label="abortar" />
        </HintBar>
      </div>
    )
  }

  if (phase === 'recall') {
    const it = ordenRecall[ri]
    if (!it) return null
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 pt-5">
          <Badge tone="am">
            {sentido === 'inverso' ? <ArrowLeft size={11} /> : <ArrowRight size={11} />}
            RECORRIDO {sentido === 'inverso' ? 'INVERSO' : 'DIRECTO'} · {ri + 1} / {ordenRecall.length}
          </Badge>
          <span className="font-mono text-[11px] text-mute">¿qué había en este punto?</span>
        </div>
        <div className="px-6 pt-3"><Progress value={ri} max={ordenRecall.length} tone="am" /></div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-7 px-6">
          <div key={ri} className="anim-pop text-center font-mono text-4xl font-bold text-vi sm:text-5xl">
            {it.locus}
          </div>
          <input
            ref={inputRef}
            value={input}
            disabled={!!feedback}
            onChange={(e) => setInput(e.target.value)}
            placeholder="¿qué colocaste aquí?"
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            enterKeyHint="done"
            className={cx(
              'w-full max-w-xl rounded-xl border bg-ink-900/60 px-5 py-4 text-center font-mono text-2xl text-slate-100 transition-colors placeholder:text-slate-700',
              feedback === 'ok' ? 'border-gr/70 glow-gr'
                : feedback === 'fail' ? 'border-rd/70 glow-rd'
                  : 'border-line focus:border-am/60',
            )}
          />
          {feedback === 'fail' && (
            <div className="anim-in font-mono text-sm text-rd">
              era → <b className="text-slate-200">{it.clave}</b>
            </div>
          )}
        </div>

        <HintBar>
          <KeyHint keys={['ENTER']} label="confirmar" tone="am" />
          <KeyHint keys={['ESC']} label="abortar" />
        </HintBar>
      </div>
    )
  }

  if (phase === 'done' && summary) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <SectionTitle icon={Landmark} right={<Badge tone="gr">RECORRIDO COMPLETADO</Badge>}>
            {summary.palacio} · recorrido {summary.sentido}
          </SectionTitle>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Secuencia intacta"
              value={summary.intacta}
              unit={`de ${summary.total}`}
              tone={summary.intacta === summary.total ? 'gr' : summary.intacta > summary.total / 2 ? 'am' : 'rd'}
              icon={Target}
              sub="antes del primer fallo"
            />
            <Stat label="Aciertos" value={`${summary.correctos}/${summary.total}`} sub={`${summary.accuracy} %`} />
            <Stat label="Tiempo de recorrido" value={fmtClock(summary.loadMs)} icon={Timer} />
            <Stat label="Por punto" value={summary.msPorLocus} unit="ms" tone="vi" />
          </div>

          <Panel className="mt-4">
            <p className="text-xs leading-relaxed text-mute">
              {summary.intacta === summary.total
                ? summary.sentido === 'inverso'
                  ? 'Recorrido inverso perfecto: las imágenes están ancladas al sitio, no encadenadas unas a otras. Eso es un palacio bien construido.'
                  : 'Recorrido directo perfecto. Ahora pruébalo en inverso: ahí se ve si cada objeto está de verdad clavado en su punto.'
                : 'Donde se rompe la secuencia es donde la imagen era floja o el punto del itinerario no está claro. Revisa ese punto concreto antes de alargar el palacio.'}
            </p>
          </Panel>

          {summary.fallos.length > 0 && (
            <Panel className="mt-4">
              <SectionTitle icon={XCircle} right={<Badge tone="rd">{summary.fallos.length}</Badge>}>
                Puntos que fallaron
              </SectionTitle>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {summary.fallos.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-line-soft px-3 py-2 font-mono text-xs">
                    <XCircle size={13} className="shrink-0 text-rd" />
                    <span className="text-vi">{f.locus}</span>
                    <span className="text-mute">→</span>
                    <span className="text-slate-300">{f.esperado}</span>
                    {f.dado && <span className="ml-auto truncate text-rd/70 line-through">{f.dado}</span>}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Btn tone="vi" size="lg" onClick={start}>
              <RotateCcw size={13} className="mr-1.5 inline" /> Repetir · R
            </Btn>
            <Btn tone="mute" onClick={() => setPhase('config')}>Configuración</Btn>
          </div>
        </div>
      </div>
    )
  }

  /* --------- CONFIG --------- */
  const suficienteMaterial =
    fuente !== 'propia' || disponiblesPropia >= clamp(cantidad, 3, maxItems || 3)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <div className="mb-6">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-slate-100">
            Módulo 7 · <span className="text-vi">Palacio de la memoria</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-mute">
            Almacenamiento <b className="text-vi">ordenado</b>. Recorres un itinerario que ya te
            sabes de memoria y dejas un objeto en cada punto; después reconstruyes la secuencia
            entera. Es lo único que entrena la recuperación en orden, que los otros módulos no
            tocan porque evocan en desorden.
          </p>
        </div>

        {palaces.length === 0 ? (
          <Panel>
            <EmptyState icon={Landmark} title="Aún no has construido ningún palacio">
              Necesitas un itinerario tuyo: un recorrido por un sitio que conozcas de memoria y que
              puedas repetir siempre igual. Nadie puede dártelo hecho.
            </EmptyState>
            <div className="flex justify-center">
              <Btn tone="vi" size="lg" onClick={() => abrirEditor(null)}>
                <Plus size={13} className="mr-1.5 inline" /> Construir mi primer palacio
              </Btn>
            </div>
          </Panel>
        ) : (
          <>
            <Panel className="space-y-6">
              <div>
                <SectionTitle icon={Landmark} right={
                  <Btn tone="mute" size="sm" onClick={() => abrirEditor(null)}>
                    <Plus size={11} className="mr-1 inline" /> Nuevo
                  </Btn>
                }>
                  Itinerario
                </SectionTitle>
                <div className="grid gap-2 sm:grid-cols-2">
                  {palaces.map((p) => {
                    const activo = p.id === palacio?.id
                    return (
                      <div
                        key={p.id}
                        className={cx(
                          'group relative flex items-center gap-3 rounded-xl border px-4 py-3 transition-all',
                          activo ? 'border-vi/60 bg-vi/8' : 'border-line hover:border-slate-600',
                        )}
                      >
                        <button type="button" onClick={() => setPalacioId(p.id)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-sm font-medium text-slate-200">{p.nombre}</span>
                          <span className="block font-mono text-[10px] text-mute">{p.loci.length} puntos</span>
                        </button>
                        <button type="button" onClick={() => abrirEditor(p)} className="rounded p-1 text-mute hover:text-cy">
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (window.confirm(`¿Borrar el palacio "${p.nombre}"?`)) removePalace(p.id) }}
                          className="rounded p-1 text-mute hover:text-rd"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <SectionTitle icon={Target}>Qué colocar</SectionTitle>
                <Choice
                  value={fuente}
                  onChange={setFuente}
                  options={[
                    { value: 'nouns', label: 'Objetos concretos' },
                    { value: 'lang', label: `Vocabulario · ${deck.tag}` },
                    { value: 'numeros', label: 'Números (casillero)' },
                    { value: 'propia', label: 'Lista propia' },
                  ]}
                />
                {fuente === 'propia' && (
                  <textarea
                    value={propia}
                    onChange={(e) => setPropia(e.target.value)}
                    rows={5}
                    placeholder="Un elemento por línea o separados por comas..."
                    className="mt-3 w-full rounded-xl border border-line bg-ink-950/60 p-3 font-mono text-xs text-slate-300 placeholder:text-slate-700 focus:border-vi/50"
                  />
                )}
                <p className="mt-2 text-xs text-mute">
                  {fuente === 'numeros' && 'Se coloca la palabra del casillero y luego tienes que recordar las dos cifras. Une el palacio con el sistema numérico.'}
                  {fuente === 'lang' && 'Coloca palabras del idioma activo y las evocas escritas. Buen puente entre el palacio y el vocabulario.'}
                  {fuente === 'nouns' && 'Sustantivos concretos del banco: lo más fácil de visualizar para practicar la técnica en sí.'}
                  {fuente === 'propia' && `${disponiblesPropia} elementos detectados.`}
                </p>
              </div>

              <div>
                <SectionTitle icon={ArrowRight}>Recorrido y longitud</SectionTitle>
                <Choice
                  value={sentido}
                  onChange={setSentido}
                  options={[
                    { value: 'directo', label: '→ Directo' },
                    { value: 'inverso', label: '← Inverso' },
                  ]}
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Choice
                    options={[5, 10, 15, 20].filter((n) => n <= maxItems).map((n) => ({ value: n, label: `${n}` }))}
                    value={cantidad}
                    onChange={setCantidad}
                  />
                  <span className="font-mono text-[11px] text-mute">
                    de {maxItems} puntos disponibles
                  </span>
                </div>
                <p className="mt-2 text-xs text-mute">
                  {sentido === 'inverso'
                    ? 'Se pregunta del último punto al primero. Solo se supera si cada objeto está anclado a su sitio, no encadenado al anterior.'
                    : 'Se pregunta en el orden del recorrido.'}
                </p>
              </div>
            </Panel>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Btn tone="vi" size="lg" onClick={start} disabled={!palacio || maxItems < 3 || !suficienteMaterial}>
                <Play size={13} className="mr-1.5 inline" /> Empezar recorrido · ENTER
              </Btn>
              {!suficienteMaterial && (
                <span className="font-mono text-[11px] text-rd">
                  tu lista tiene {disponiblesPropia} elementos y hacen falta {cantidad}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
