import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine,
} from 'recharts'
import {
  Gauge, Zap, Eye, Flame, Layers, Trophy, Activity, BarChart3, Trash2, Download,
  CalendarClock, Brain, Hash, Landmark,
} from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { fmtDate, fmtDateTime, fmtClock, round, mean, downloadJSON } from '../lib/utils.js'
import { Panel, Stat, SectionTitle, Badge, Btn, EmptyState, cx } from '../components/ui.jsx'

const AXIS = { stroke: '#33456b', fontSize: 10, fontFamily: 'monospace' }

function ChartTip({ active, payload, label, unit, name }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-ink-950/95 px-3 py-2 font-mono text-[11px] shadow-xl">
      <div className="text-mute">{label}</div>
      <div className="text-ink">
        {name}: <b style={{ color: payload[0].color }}>{payload[0].value}</b> {unit}
      </div>
    </div>
  )
}

function streakDays(sessions) {
  if (!sessions.length) return 0
  const days = new Set(sessions.map((s) => new Date(s.ts).toDateString()))
  let streak = 0
  const cursor = new Date()
  // Permite que la racha siga viva si hoy aún no se ha entrenado
  if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1)
  while (days.has(cursor.toDateString())) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export default function Dashboard() {
  const { sessions, clearSessions, settings, decks, deck, reviews, resumenRepaso } = useApp()

  const massive = useMemo(
    () => sessions.filter((s) => s.module === 'massive').sort((a, b) => a.ts - b.ts),
    [sessions],
  )
  const revisiones = useMemo(
    () => sessions.filter((s) => s.module === 'review').sort((a, b) => a.ts - b.ts),
    [sessions],
  )

  // El VRN de un lote de 5 y el de uno de 100 no son comparables: los lotes
  // pequeños puntúan siempre más alto. La curva se segmenta por tamaño y arranca
  // en el que más se haya usado.
  const tamanos = useMemo(() => {
    const cuenta = new Map()
    for (const s of massive) cuenta.set(s.batch, (cuenta.get(s.batch) || 0) + 1)
    return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]).map(([n]) => n)
  }, [massive])
  const [lote, setLote] = useState(null)
  const loteActivo = lote ?? tamanos[0] ?? null
  const massiveLote = useMemo(
    () => massive.filter((s) => s.batch === loteActivo),
    [massive, loteActivo],
  )
  const warmup = useMemo(
    () => sessions.filter((s) => s.module === 'warmup').sort((a, b) => a.ts - b.ts),
    [sessions],
  )
  const rsvp = useMemo(
    () => sessions.filter((s) => s.module === 'rsvp').sort((a, b) => a.ts - b.ts),
    [sessions],
  )

  const kpi = useMemo(() => {
    const bestVrn = massiveLote.length ? Math.max(...massiveLote.map((s) => s.vrn)) : null
    const lastVrn = massiveLote.length ? massiveLote[massiveLote.length - 1].vrn : null
    const perfect = massiveLote.filter((s) => s.accuracy === 100)
    const bestPerfectVrn = perfect.length ? Math.max(...perfect.map((s) => s.vrn)) : null
    const conRet = revisiones.filter((s) => s.retencion24h != null)
    const retencionUlt = conRet.length ? conRet[conRet.length - 1].retencion24h : null
    const retencionMedia = conRet.length ? mean(conRet.map((s) => s.retencion24h)) : null
    const bestReaction = warmup.length ? Math.min(...warmup.map((s) => s.avgMs)) : null
    const lastReaction = warmup.length ? warmup[warmup.length - 1].avgMs : null
    const validated = rsvp.filter((s) => s.validated)
    const maxPpm = validated.length ? Math.max(...validated.map((s) => s.ppm)) : null
    const totalWords = massive.reduce((a, s) => a + s.correct, 0)
    const totalLoadMs = massive.reduce((a, s) => a + s.loadMs, 0)
    const avgAcc = massive.length ? mean(massive.map((s) => s.accuracy)) : null
    return {
      bestVrn, lastVrn, bestPerfectVrn, bestReaction, lastReaction, maxPpm,
      totalWords, totalLoadMs, avgAcc, streak: streakDays(sessions),
      retencionUlt, retencionMedia,
    }
  }, [massive, massiveLote, revisiones, warmup, rsvp, sessions])

  const vrnData = massiveLote.map((s, i) => ({
    i: i + 1,
    x: fmtDate(s.ts),
    vrn: s.vrn,
    acc: s.accuracy,
    lang: s.langName,
  }))
  const retencionData = revisiones
    .filter((s) => s.retencion24h != null)
    .map((s, i) => ({ i: i + 1, x: fmtDate(s.ts), ret: s.retencion24h, n: s.primeros }))
  const reactionData = warmup.map((s, i) => ({
    i: i + 1,
    x: fmtDate(s.ts),
    ms: Math.round(s.avgMs),
    recall: s.recallPct,
  }))
  const ppmData = rsvp.map((s, i) => ({
    i: i + 1,
    x: fmtDate(s.ts),
    ppm: s.ppm,
    validated: s.validated,
  }))

  const recent = [...sessions].sort((a, b) => b.ts - a.ts).slice(0, 12)

  const exportAll = () =>
    downloadJSON(`gimnasio-mental-${new Date().toISOString().slice(0, 10)}.json`, {
      exportedAt: new Date().toISOString(),
      settings,
      decks,
      sessions,
    })

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Cabecera */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-mono text-2xl font-bold tracking-tight text-ink">
              Panel de <span className="text-cy">alto rendimiento</span>
            </h1>
            <p className="mt-1 text-sm text-mute">
              Idioma activo: <b className="text-ink-2">{deck.name}</b> · {sessions.length}{' '}
              sesiones registradas
            </p>
          </div>
          <div className="flex gap-2">
            <Btn tone="mute" size="sm" onClick={exportAll} disabled={!sessions.length}>
              <Download size={11} className="mr-1 inline" /> Exportar
            </Btn>
            <Btn
              tone="rd"
              size="sm"
              disabled={!sessions.length}
              onClick={() => {
                if (window.confirm('¿Borrar todo el histórico de sesiones? No se puede deshacer.'))
                  clearSessions()
              }}
            >
              <Trash2 size={11} className="mr-1 inline" /> Borrar
            </Btn>
          </div>
        </div>

        {!sessions.length ? (
          <Panel>
            <EmptyState icon={Activity} title="Sin datos todavía">
              Completa un bloque en cualquier módulo y aquí aparecerán tus curvas de VRN, tiempo de
              reacción y velocidad de procesamiento visual. Pulsa{' '}
              <b className="text-cy">2</b>, <b className="text-cy">3</b> o{' '}
              <b className="text-cy">4</b> para empezar.
            </EmptyState>
          </Panel>
        ) : (
          <>
            {/* Repasos pendientes: la deuda de retención, siempre visible */}
            {resumenRepaso.total > 0 && (
              <Panel
                className={cx('mb-3', resumenRepaso.pendientes > 0 && 'border-am/40')}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CalendarClock
                      size={18}
                      className={resumenRepaso.pendientes ? 'text-am' : 'text-gr'}
                    />
                    <div>
                      <div className="font-mono text-sm font-bold text-ink">
                        {resumenRepaso.pendientes
                          ? `${resumenRepaso.pendientes} palabras esperando repaso`
                          : 'Repaso al día'}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-mute">
                        {resumenRepaso.total} en seguimiento ·{' '}
                        {resumenRepaso.consolidadas} consolidadas
                        {resumenRepaso.proximo && !resumenRepaso.pendientes
                          ? ` · vuelve el ${fmtDateTime(resumenRepaso.proximo)}`
                          : ''}
                      </div>
                    </div>
                  </div>
                  <Badge tone={resumenRepaso.pendientes ? 'am' : 'gr'}>
                    TECLA 4 · REPASO
                  </Badge>
                </div>
              </Panel>
            )}

            {/* KPIs */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Retención a 24 h"
                value={kpi.retencionUlt ?? '--'}
                unit="%"
                tone={
                  kpi.retencionUlt == null ? 'cy'
                    : kpi.retencionUlt >= 80 ? 'gr'
                      : kpi.retencionUlt >= 60 ? 'am' : 'rd'
                }
                icon={Brain}
                sub={
                  kpi.retencionMedia != null
                    ? `media histórica: ${round(kpi.retencionMedia, 1)} %`
                    : 'aún sin primeros repasos'
                }
              />
              <Stat
                label={loteActivo ? `VRN récord (lotes de ${loteActivo})` : 'VRN récord'}
                value={kpi.bestVrn ?? '--'}
                unit="pal/min"
                icon={Gauge}
                sub={kpi.lastVrn != null ? `última sesión: ${kpi.lastVrn}` : 'sin bloques aún'}
              />
              <Stat
                label="Reacción mínima"
                value={kpi.bestReaction != null ? Math.round(kpi.bestReaction) : '--'}
                unit="ms"
                tone="vi"
                icon={Zap}
                sub={
                  kpi.lastReaction != null
                    ? `última media: ${Math.round(kpi.lastReaction)} ms`
                    : 'sin calentamientos'
                }
              />
              <Stat
                label="Racha"
                value={kpi.streak}
                unit={kpi.streak === 1 ? 'día' : 'días'}
                tone="gr"
                icon={Flame}
                sub="días consecutivos entrenando"
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="PPM máx. validado"
                value={kpi.maxPpm ?? '--'}
                unit="ppm"
                tone="am"
                icon={Eye}
                sub={`${rsvp.length} ráfagas lanzadas`}
              />
              <Stat
                label="Consolidadas"
                value={resumenRepaso.consolidadas}
                unit="palabras"
                tone="gr"
                icon={Brain}
                sub="aguantan 21 días o más"
              />
              <Stat
                label="En seguimiento"
                value={resumenRepaso.total}
                unit="fichas"
                icon={CalendarClock}
                sub={`${resumenRepaso.pendientes} pendientes ahora`}
              />
              <Stat
                label="Sesiones de repaso"
                value={revisiones.length}
                icon={Activity}
              />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Palabras retenidas"
                value={kpi.totalWords}
                unit="acumuladas"
                tone="gr"
                icon={Layers}
              />
              <Stat
                label="Tiempo total de carga"
                value={fmtClock(kpi.totalLoadMs)}
                icon={Activity}
              />
              <Stat
                label="Precisión media"
                value={kpi.avgAcc != null ? round(kpi.avgAcc, 1) : '--'}
                unit="%"
                tone="vi"
                icon={BarChart3}
              />
              <Stat
                label="VRN con 100 % acierto"
                value={kpi.bestPerfectVrn ?? '--'}
                unit="pal/min"
                tone="am"
                icon={Trophy}
                sub="marca limpia"
              />
            </div>

            {/* Grafica principal: retención, que es lo que de verdad importa */}
            <Panel className="mt-4">
              <SectionTitle
                icon={Brain}
                right={<Badge tone="gr">MÓDULO 4 · {retencionData.length} repasos</Badge>}
              >
                Retención a 24 horas
              </SectionTitle>
              {retencionData.length < 1 ? (
                <EmptyState title="Sin primeros repasos todavía">
                  Memoriza un bloque y vuelve mañana: aquí verás cuánto sobrevivió de verdad. Esta
                  curva vale más que el VRN.
                </EmptyState>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <AreaChart data={retencionData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gRet" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#26ff9c" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#26ff9c" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#16223a" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="x" {...AXIS} tickLine={false} axisLine={false} />
                      <YAxis {...AXIS} tickLine={false} axisLine={false} width={44} domain={[0, 100]} />
                      <Tooltip content={<ChartTip unit="%" name="Retención" />} cursor={{ stroke: '#26ff9c', strokeOpacity: 0.25 }} />
                      <ReferenceLine y={80} stroke="#00e5ff" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <Area
                        type="monotone"
                        dataKey="ret"
                        stroke="#26ff9c"
                        strokeWidth={2}
                        fill="url(#gRet)"
                        dot={{ r: 2.5, fill: '#26ff9c', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="mt-2 font-mono text-[10px] text-mute">
                línea azul = objetivo 80 % · porcentaje de aciertos en el primer repaso de cada palabra
              </p>
            </Panel>

            {/* VRN, segmentado por tamaño de lote */}
            <Panel className="mt-3">
              <SectionTitle
                icon={Gauge}
                right={
                  tamanos.length > 1 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] uppercase text-mute">lotes de</span>
                      {tamanos.slice(0, 5).map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setLote(n)}
                          className={cx(
                            'rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold transition-colors',
                            n === loteActivo
                              ? 'border-cy/60 bg-cy/12 text-cy'
                              : 'border-line text-mute hover:text-ink-2',
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Badge tone="cy">MÓDULO 3 · {massiveLote.length} bloques</Badge>
                  )
                }
              >
                Velocidad de carga (VRN)
              </SectionTitle>
              {massiveLote.length < 1 ? (
                <EmptyState title="Sin bloques de memorización" />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer>
                    <AreaChart data={vrnData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gVrn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#00e5ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#16223a" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="x" {...AXIS} tickLine={false} axisLine={false} />
                      <YAxis {...AXIS} tickLine={false} axisLine={false} width={44} />
                      <Tooltip content={<ChartTip unit="pal/min" name="VRN" />} cursor={{ stroke: '#00e5ff', strokeOpacity: 0.25 }} />
                      {kpi.bestVrn != null && (
                        <ReferenceLine
                          y={kpi.bestVrn}
                          stroke="#a855f7"
                          strokeDasharray="4 4"
                          strokeOpacity={0.6}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="vrn"
                        stroke="#00e5ff"
                        strokeWidth={2}
                        fill="url(#gVrn)"
                        dot={{ r: 2.5, fill: '#00e5ff', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="mt-2 font-mono text-[10px] text-mute">
                solo lotes de {loteActivo} palabras · los tamaños no se mezclan porque los lotes
                pequeños puntúan siempre más alto
              </p>
            </Panel>

            {/* Reaccion + PPM */}
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <Panel>
                <SectionTitle icon={Zap} right={<Badge tone="vi">MÓDULO 1</Badge>}>
                  Tiempo de enganche (ms/imagen)
                </SectionTitle>
                {warmup.length < 1 ? (
                  <EmptyState title="Sin calentamientos" />
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <LineChart data={reactionData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#16223a" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="x" {...AXIS} tickLine={false} axisLine={false} />
                        <YAxis {...AXIS} tickLine={false} axisLine={false} width={44} />
                        <Tooltip content={<ChartTip unit="ms" name="Media" />} cursor={{ stroke: '#a855f7', strokeOpacity: 0.25 }} />
                        <ReferenceLine y={1500} stroke="#26ff9c" strokeDasharray="4 4" strokeOpacity={0.45} />
                        <Line
                          type="monotone"
                          dataKey="ms"
                          stroke="#a855f7"
                          strokeWidth={2}
                          dot={{ r: 2.5, fill: '#a855f7', strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="mt-2 font-mono text-[10px] text-mute">
                  línea verde = objetivo 1500 ms · menos es mejor
                </p>
              </Panel>

              <Panel>
                <SectionTitle icon={Eye} right={<Badge tone="am">MÓDULO 3</Badge>}>
                  Velocidad de procesamiento visual
                </SectionTitle>
                {rsvp.length < 1 ? (
                  <EmptyState title="Sin ráfagas" />
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <LineChart data={ppmData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#16223a" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="x" {...AXIS} tickLine={false} axisLine={false} />
                        <YAxis {...AXIS} tickLine={false} axisLine={false} width={44} domain={[250, 950]} />
                        <Tooltip content={<ChartTip unit="ppm" name="Velocidad" />} cursor={{ stroke: '#ffb020', strokeOpacity: 0.25 }} />
                        <Line
                          type="monotone"
                          dataKey="ppm"
                          stroke="#ffb020"
                          strokeWidth={2}
                          dot={(props) => {
                            const { cx: x, cy: y, payload, index } = props
                            return (
                              <circle
                                key={index}
                                cx={x}
                                cy={y}
                                r={3}
                                fill={payload.validated ? '#26ff9c' : '#ff4d6d'}
                              />
                            )
                          }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="mt-2 font-mono text-[10px] text-mute">
                  punto verde = nivel validado · rojo = no consolidado
                </p>
              </Panel>
            </div>

            {/* Historial */}
            <Panel className="mt-3">
              <SectionTitle icon={Activity}>Últimas sesiones</SectionTitle>
              <div className="space-y-1.5">
                {recent.map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}

function SessionRow({ s }) {
  const meta = {
    warmup: { label: 'CALENTAMIENTO', tone: 'vi', icon: Zap, color: 'text-vi' },
    massive: { label: 'MEMORIZACIÓN', tone: 'cy', icon: Layers, color: 'text-cy' },
    review: { label: 'REPASO', tone: 'gr', icon: CalendarClock, color: 'text-gr' },
    rsvp: { label: 'TAQUISTOSCOPIO', tone: 'am', icon: Eye, color: 'text-am' },
    numbers: { label: 'NÚMEROS', tone: 'vi', icon: Hash, color: 'text-vi' },
    palace: { label: 'PALACIO', tone: 'vi', icon: Landmark, color: 'text-vi' },
  }[s.module]
  if (!meta) return null
  const Icon = meta.icon

  let detail = null
  if (s.module === 'massive')
    detail = (
      <>
        <span className="text-cy">VRN {s.vrn}</span>
        <span className="text-mute">·</span>
        <span>{s.correct}/{s.total} ({s.accuracy} %)</span>
        <span className="text-mute">·</span>
        <span>carga {fmtClock(s.loadMs)}</span>
      </>
    )
  if (s.module === 'warmup')
    detail = (
      <>
        <span className="text-vi">{Math.round(s.avgMs)} ms media</span>
        <span className="text-mute">·</span>
        <span>{s.rounds} parejas</span>
        <span className="text-mute">·</span>
        <span>evocación {s.recallPct} %</span>
      </>
    )
  if (s.module === 'rsvp')
    detail = (
      <>
        <span className="text-am">{s.ppm} PPM</span>
        <span className="text-mute">·</span>
        <span>{s.words} palabras</span>
        <span className="text-mute">·</span>
        <span className={s.validated ? 'text-gr' : 'text-rd'}>
          {s.validated ? 'validado' : 'no validado'}
        </span>
      </>
    )
  if (s.module === 'review')
    detail = (
      <>
        {s.retencion24h != null && (
          <>
            <span className="text-gr">retención {s.retencion24h} %</span>
            <span className="text-mute">·</span>
          </>
        )}
        <span>{s.correct}/{s.total} ({s.accuracy} %)</span>
        {s.primeros > 0 && (
          <>
            <span className="text-mute">·</span>
            <span>{s.primeros} estrenaban repaso</span>
          </>
        )}
      </>
    )
  if (s.module === 'numbers')
    detail =
      s.tipo === 'conversion' ? (
        <>
          <span className="text-vi">casillero</span>
          <span className="text-mute">·</span>
          <span>{s.correct}/{s.total} ({s.accuracy} %)</span>
          <span className="text-mute">·</span>
          <span>{s.msMedio} ms de media</span>
        </>
      ) : (
        <>
          <span className="text-vi">{s.tipo}</span>
          <span className="text-mute">·</span>
          <span>{s.intacta}/{s.total} en orden</span>
          <span className="text-mute">·</span>
          <span>{s.porMinuto} por minuto</span>
        </>
      )
  if (s.module === 'palace')
    detail = (
      <>
        <span className="text-vi">{s.palacio}</span>
        <span className="text-mute">·</span>
        <span>{s.intacta}/{s.total} en orden</span>
        <span className="text-mute">·</span>
        <span>recorrido {s.sentido}</span>
      </>
    )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line-soft px-3 py-2 font-mono text-[11px]">
      <Icon size={13} className={cx('shrink-0', meta.color)} />
      <Badge tone={meta.tone}>{meta.label}</Badge>
      <span className="text-ink-3">{s.langName || s.lang}</span>
      <span className="flex flex-wrap items-center gap-x-2 text-ink-2">{detail}</span>
      <span className="ml-auto text-mute">{fmtDateTime(s.ts)}</span>
    </div>
  )
}
