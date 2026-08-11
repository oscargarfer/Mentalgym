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
import { NAV, CAPACIDADES } from '../components/Shell.jsx'
import { pulsar } from '../lib/tactil.js'
import { fmtDate, fmtDateTime, fmtClock, round, mean, downloadJSON } from '../lib/utils.js'
import { Panel, Stat, SectionTitle, Badge, Btn, EmptyState, cx } from '../components/ui.jsx'

const AXIS = { stroke: '#9a958b', fontSize: 10, fontFamily: 'monospace' }

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
            {/* Serif y una sola tinta. El monoespaciado a dos colores era del
                diseño anterior y hacía que el encabezado pareciera una consola. */}
            <h1 className="font-serif text-[30px] font-semibold leading-none tracking-[-0.015em] text-ink">
              Registro
            </h1>
            <p className="mt-1.5 text-[13px] text-ink-3">
              Material: <b className="font-semibold text-ink-2">{deck.name}</b> ·{' '}
              {sessions.length} {sessions.length === 1 ? 'sesión' : 'sesiones'}
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
          /* Sin datos, la pantalla no debe ser un recuadro enorme y vacío: es el
             momento de decir por dónde se empieza. */
          <div className="border-t border-rule pt-5">
            <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-2">
              Todavía no has entrenado. En cuanto completes un bloque, aquí verás el estado de
              tus cuatro capacidades y cómo evolucionan.
            </p>
            <div className="mt-5 grid gap-px border border-rule bg-rule sm:grid-cols-2">
              {NAV.filter((n) => n.cap).slice(0, 4).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => pulsar(n.key)}
                  className="flex items-baseline gap-3 bg-paper px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="num text-[11px] text-ink-3">{n.key.padStart(2, '0')}</span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-ink">{n.label}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-3">
                      <i
                        className={cx(
                          'inline-block h-[7px] w-[7px] shrink-0',
                          { aso: 'bg-aso', ord: 'bg-ord', ret: 'bg-ret', pro: 'bg-pro' }[n.cap],
                        )}
                      />
                      {CAPACIDADES[n.cap].nombre} · {n.desc}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] text-ink-3">
              Si es tu primer día, empieza por Calentamiento. La guía completa está en Método
              (tecla 8).
            </p>
          </div>
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

            {/* Las cuatro capacidades */}
            <Capacidades kpi={kpi} sessions={sessions} />

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label={loteActivo ? `VRN récord (lotes de ${loteActivo})` : 'VRN récord'}
                value={kpi.bestVrn ?? '--'}
                unit="pal/min"
                icon={Gauge}
                sub={kpi.lastVrn != null ? `última sesión: ${kpi.lastVrn}` : 'sin bloques aún'}
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
                          <stop offset="0%" stopColor="#067a4f" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#067a4f" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#dad7d0" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="x" {...AXIS} tickLine={false} axisLine={false} />
                      <YAxis {...AXIS} tickLine={false} axisLine={false} width={44} domain={[0, 100]} />
                      <Tooltip content={<ChartTip unit="%" name="Retención" />} cursor={{ stroke: '#067a4f', strokeOpacity: 0.25 }} />
                      <ReferenceLine y={80} stroke="#8a5a12" strokeDasharray="4 4" strokeOpacity={0.5} />
                      <Area
                        type="monotone"
                        dataKey="ret"
                        stroke="#067a4f"
                        strokeWidth={2}
                        fill="url(#gRet)"
                        dot={{ r: 2.5, fill: '#067a4f', strokeWidth: 0 }}
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
                          <stop offset="0%" stopColor="#8a5a12" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#8a5a12" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#dad7d0" strokeDasharray="3 6" vertical={false} />
                      <XAxis dataKey="x" {...AXIS} tickLine={false} axisLine={false} />
                      <YAxis {...AXIS} tickLine={false} axisLine={false} width={44} />
                      <Tooltip content={<ChartTip unit="pal/min" name="VRN" />} cursor={{ stroke: '#8a5a12', strokeOpacity: 0.25 }} />
                      {kpi.bestVrn != null && (
                        <ReferenceLine
                          y={kpi.bestVrn}
                          stroke="#5b3fa8"
                          strokeDasharray="4 4"
                          strokeOpacity={0.6}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="vrn"
                        stroke="#8a5a12"
                        strokeWidth={2}
                        fill="url(#gVrn)"
                        dot={{ r: 2.5, fill: '#8a5a12', strokeWidth: 0 }}
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
                        <CartesianGrid stroke="#dad7d0" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="x" {...AXIS} tickLine={false} axisLine={false} />
                        <YAxis {...AXIS} tickLine={false} axisLine={false} width={44} />
                        <Tooltip content={<ChartTip unit="ms" name="Media" />} cursor={{ stroke: '#5b3fa8', strokeOpacity: 0.25 }} />
                        <ReferenceLine y={1500} stroke="#067a4f" strokeDasharray="4 4" strokeOpacity={0.45} />
                        <Line
                          type="monotone"
                          dataKey="ms"
                          stroke="#5b3fa8"
                          strokeWidth={2}
                          dot={{ r: 2.5, fill: '#5b3fa8', strokeWidth: 0 }}
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
                        <CartesianGrid stroke="#dad7d0" strokeDasharray="3 6" vertical={false} />
                        <XAxis dataKey="x" {...AXIS} tickLine={false} axisLine={false} />
                        <YAxis {...AXIS} tickLine={false} axisLine={false} width={44} domain={[250, 950]} />
                        <Tooltip content={<ChartTip unit="ppm" name="Velocidad" />} cursor={{ stroke: '#a06a08', strokeOpacity: 0.25 }} />
                        <Line
                          type="monotone"
                          dataKey="ppm"
                          stroke="#a06a08"
                          strokeWidth={2}
                          dot={(props) => {
                            const { cx: x, cy: y, payload, index } = props
                            return (
                              <circle
                                key={index}
                                cx={x}
                                cy={y}
                                r={3}
                                fill={payload.validated ? '#067a4f' : '#a32217'}
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

/**
 * Las cuatro capacidades, cada una con su medida principal.
 *
 * Es la cabecera del registro porque es el marco de la aplicación: no se mira
 * el rendimiento de seis ejercicios sueltos, se mira el estado de cuatro
 * facultades. Cada una tiene un objetivo declarado, y la barra dice cuánto
 * falta para llegar; sin objetivo, un número suelto no informa de nada.
 *
 * El color va en el filete superior y el nombre siempre escrito al lado: el par
 * asociar/ordenar queda cerca para visión deutan y el color no puede ir solo.
 */
function Capacidades({ kpi, sessions }) {
  const palacios = sessions.filter((s) => s.module === 'palace')
  const ultimoPalacio = palacios[palacios.length - 1]
  const ordenPct = ultimoPalacio?.total
    ? (ultimoPalacio.intacta / ultimoPalacio.total) * 100
    : null

  const filas = [
    {
      n: '01',
      nombre: 'Asociar',
      color: 'bg-aso',
      valor: kpi.bestReaction != null ? (kpi.bestReaction / 1000).toFixed(2).replace('.', ',') : '--',
      unidad: 's',
      sub:
        kpi.lastReaction != null
          ? `por imagen · última ${(kpi.lastReaction / 1000).toFixed(2).replace('.', ',')}`
          : 'sin calentamientos aún',
      // Objetivo 1,5 s por imagen: menos es mejor, así que la barra se invierte.
      pct: kpi.bestReaction != null ? Math.min(100, (1500 / kpi.bestReaction) * 100) : 0,
    },
    {
      n: '02',
      nombre: 'Ordenar',
      color: 'bg-ord',
      valor: ultimoPalacio ? ultimoPalacio.intacta : '--',
      unidad: ultimoPalacio ? `/${ultimoPalacio.total}` : '',
      sub: ultimoPalacio
        ? `secuencia intacta · ${ultimoPalacio.sentido === 'inverso' ? 'recorrido inverso' : 'recorrido directo'}`
        : 'sin recorridos aún',
      pct: ordenPct ?? 0,
    },
    {
      n: '03',
      nombre: 'Retener',
      color: 'bg-ret',
      valor: kpi.retencionUlt ?? '--',
      unidad: '%',
      sub:
        kpi.retencionMedia != null
          ? `a las 24 horas · media ${round(kpi.retencionMedia, 1)} %`
          : 'aún sin primeros repasos',
      pct: kpi.retencionUlt ?? 0,
    },
    {
      n: '04',
      nombre: 'Procesar',
      color: 'bg-pro',
      valor: kpi.maxPpm ?? '--',
      unidad: 'ppm',
      sub: kpi.maxPpm != null ? 'máximo con ráfaga validada' : 'sin ráfagas validadas',
      // 900 ppm es el techo del módulo, no un límite de la lectura humana.
      pct: kpi.maxPpm != null ? Math.min(100, (kpi.maxPpm / 900) * 100) : 0,
    },
  ]

  return (
    <div className="grid border-t border-rule sm:grid-cols-2 lg:grid-cols-4">
      {filas.map((f, i) => (
        <div
          key={f.n}
          className={cx(
            'relative border-b border-rule bg-paper px-4 pb-4 pt-3.5',
            i < filas.length - 1 && 'lg:border-r',
            i % 2 === 0 && 'sm:border-r lg:border-r',
          )}
        >
          <span className={cx('absolute inset-x-0 top-0 h-[2px]', f.color)} />
          <div className="num text-[10.5px] text-ink-3">CAPACIDAD {f.n}</div>
          <h3 className="mt-0.5 text-[13px] font-bold uppercase tracking-[0.02em] text-ink">
            {f.nombre}
          </h3>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="cifra text-[36px] leading-none text-ink">{f.valor}</span>
            {f.unidad && <span className="text-[13px] text-ink-3">{f.unidad}</span>}
          </div>
          <div className="mt-1.5 text-[11.5px] leading-tight text-ink-3">{f.sub}</div>
          <div className="mt-3 h-[3px] bg-rule">
            <div className={cx('h-full', f.color)} style={{ width: `${Math.min(100, f.pct)}%` }} />
          </div>
        </div>
      ))}
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
