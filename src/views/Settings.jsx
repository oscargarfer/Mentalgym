import { useRef, useState } from 'react'
import {
  Languages, Upload, Trash2, Check, Volume2, Timer, Database, FileJson, AlertTriangle, Download,
  CalendarClock, Hash,
} from 'lucide-react'
import { useApp } from '../state/AppContext.jsx'
import { parseDeck, downloadJSON } from '../lib/utils.js'
import { INTERVALOS } from '../lib/srs.js'
import { palabraACasilla } from '../data/pegs.js'
import { Panel, SectionTitle, Btn, Badge, Toggle, NumberField, Choice, cx } from '../components/ui.jsx'

const SAMPLE = `[
  { "w": "hello", "m": "hola" },
  { "w": "goodbye", "m": "adiós" }
]

--- o en CSV ---

palabra,significado
hello,hola
goodbye,adiós`

export default function Settings() {
  const {
    settings, update, allDecks, deck, addDeck, removeDeck, sessions, decks, importData,
    resumenRepaso, clearReviews, pegs, updatePeg, resetPegs,
  } = useApp()

  const [raw, setRaw] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState(null)
  const fileRef = useRef(null)
  const importRef = useRef(null)

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const text = await f.text()
    setRaw(text)
    if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
    setStatus(null)
    e.target.value = ''
  }

  const doImport = () => {
    const { entries, error } = parseDeck(raw)
    if (error) {
      setStatus({ type: 'error', msg: error })
      return
    }
    const id = addDeck(name.trim() || 'Mazo personalizado', entries)
    update({ langId: id })
    setStatus({ type: 'ok', msg: `${entries.length} palabras importadas y activadas.` })
    setRaw('')
    setName('')
  }

  const handleBackupFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const data = JSON.parse(await f.text())
      importData(data)
      setStatus({ type: 'ok', msg: 'Copia de seguridad restaurada.' })
    } catch {
      setStatus({ type: 'error', msg: 'El archivo no es una copia válida.' })
    }
    e.target.value = ''
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <h1 className="mb-6 font-mono text-2xl font-bold tracking-tight text-slate-100">
          Ajustes del <span className="text-cy">gimnasio</span>
        </h1>

        {/* ---- Idioma objetivo ---- */}
        <Panel>
          <SectionTitle
            icon={Languages}
            right={<Badge tone="cy">{deck.count.toLocaleString('es-ES')} palabras</Badge>}
          >
            Idioma objetivo
          </SectionTitle>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {allDecks.map((d) => {
              const active = d.id === settings.langId
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => update({ langId: d.id })}
                  className={cx(
                    'group relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                    active
                      ? 'border-cy/60 bg-cy/8 glow-cy'
                      : 'border-line hover:border-slate-600 hover:bg-white/3',
                  )}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] font-bold"
                    style={{
                      borderColor: `${d.accent}55`,
                      color: d.accent,
                      background: `${d.accent}12`,
                    }}
                  >
                    {d.tag}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-200">
                      {d.name}
                    </span>
                    <span className="block font-mono text-[10px] text-mute">
                      {d.count.toLocaleString('es-ES')} palabras {d.custom && '· personalizado'}
                    </span>
                  </span>
                  {active && <Check size={15} className="shrink-0 text-cy" />}
                  {d.custom && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`¿Eliminar el mazo "${d.name}"?`)) removeDeck(d.id)
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && removeDeck(d.id)}
                      className="absolute right-1.5 top-1.5 rounded p-1 text-mute opacity-0 transition-opacity hover:text-rd group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-mute">
            Los mazos contienen <b className="text-slate-300">palabra extranjera → significado real
            en español</b>. La palabra puente y la imagen mental no se almacenan en ningún sitio:
            son tuyas y se crean en tu cabeza durante la carga.
          </p>
        </Panel>

        {/* ---- Importar mazo ---- */}
        <Panel className="mt-4">
          <SectionTitle icon={Upload}>Cargar idioma personalizado (JSON / CSV)</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del mazo (ej. Italiano A2)"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-ink-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-700 focus:border-cy/50"
                />
                <Btn tone="mute" size="sm" onClick={() => fileRef.current?.click()}>
                  <FileJson size={11} className="mr-1 inline" /> Archivo
                </Btn>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,.csv,.tsv,.txt"
                  onChange={handleFile}
                  className="hidden"
                />
              </div>
              <textarea
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value)
                  setStatus(null)
                }}
                rows={9}
                placeholder="Pega aquí tu JSON o CSV..."
                className="w-full rounded-xl border border-line bg-ink-950/60 p-3 font-mono text-xs text-slate-300 placeholder:text-slate-700 focus:border-cy/50"
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Btn tone="gr" onClick={doImport} disabled={!raw.trim()}>
                  Importar y activar
                </Btn>
                {status && (
                  <span
                    className={cx(
                      'flex items-center gap-1.5 font-mono text-[11px]',
                      status.type === 'ok' ? 'text-gr' : 'text-rd',
                    )}
                  >
                    {status.type === 'ok' ? <Check size={12} /> : <AlertTriangle size={12} />}
                    {status.msg}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-line-soft bg-ink-950/40 p-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                Formatos aceptados
              </div>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-slate-500">
                {SAMPLE}
              </pre>
              <p className="mt-2 font-mono text-[10px] text-mute">
                Tercera columna opcional: lectura o transliteración.
              </p>
            </div>
          </div>
        </Panel>

        {/* ---- Preferencias ---- */}
        <Panel className="mt-4">
          <SectionTitle icon={Timer}>Preferencias de sesión</SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle
              checked={settings.sound}
              onChange={(v) => update({ sound: v })}
              label="Retroalimentación sonora"
            />
            <Toggle
              checked={settings.showLoadTimer}
              onChange={(v) => update({ showLoadTimer: v })}
              label="Ver cronómetro durante la carga"
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-mute">
            <Volume2 size={12} />
            Ocultar el cronómetro reduce la ansiedad de rendimiento; el tiempo se sigue midiendo
            igual.
          </p>

          <div className="mt-4 border-t border-line-soft pt-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
              Nivel de vocabulario
            </div>
            <Choice
              options={[
                { value: 'nucleo', label: `Núcleo · ${deck.nucleo ?? '—'}` },
                { value: 'comun', label: `Común · ${deck.comun ?? '—'}` },
                { value: 'completo', label: `Completo · ${deck.total ?? deck.count}` },
              ]}
              value={settings.nivel || 'comun'}
              onChange={(v) => update({ nivel: v })}
            />
            <p className="mt-2 text-xs text-mute">
              El mazo está ordenado por frecuencia: primero las palabras que
              sostienen el idioma, después el vocabulario común y al final la
              ampliación. Empezar por el <b className="text-slate-300">núcleo</b> es
              lo que hace que memorices lo que de verdad vas a usar. Los mazos
              propios entran enteros, sea cual sea el nivel.
            </p>
          </div>

          <div className="mt-4 border-t border-line-soft pt-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
              Controles táctiles
            </div>
            <Choice
              options={[
                { value: 'auto', label: 'Automático' },
                { value: 'si', label: 'Siempre' },
                { value: 'no', label: 'Nunca' },
              ]}
              value={settings.tactil || 'auto'}
              onChange={(v) => update({ tactil: v })}
            />
            <p className="mt-2 text-xs text-mute">
              En automático aparecen solos en móvil y tableta. Los atajos de teclado siguen
              funcionando en los tres casos: los botones pulsan esas mismas teclas.
            </p>
          </div>
        </Panel>

        {/* ---- Repaso espaciado ---- */}
        <Panel className="mt-4">
          <SectionTitle
            icon={CalendarClock}
            right={<Badge tone="gr">{resumenRepaso.total} fichas</Badge>}
          >
            Repaso espaciado
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                Intervalos (días)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {settings.intervalos.map((d, i) => (
                  <input
                    key={i}
                    type="number"
                    min={1}
                    max={3650}
                    value={d}
                    onChange={(e) => {
                      const v = Math.max(1, Number(e.target.value) || 1)
                      const next = [...settings.intervalos]
                      next[i] = v
                      update({ intervalos: next })
                    }}
                    className="w-16 rounded-lg border border-line bg-ink-950/60 px-2 py-1.5 text-center font-mono text-sm text-gr"
                  />
                ))}
                <Btn tone="mute" size="sm" onClick={() => update({ intervalos: INTERVALOS })}>
                  Por defecto
                </Btn>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-mute">
                Días hasta el siguiente repaso según cuántas veces seguidas hayas acertado una
                palabra. Un fallo la devuelve al primer intervalo.
              </p>
            </div>
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                Tope por sesión
              </p>
              <NumberField
                value={settings.topeRepasoDiario}
                onChange={(v) => update({ topeRepasoDiario: Math.max(5, Math.min(500, v || 5)) })}
                min={5}
                max={500}
                suffix="palabras"
              />
              <p className="mt-2 text-xs leading-relaxed text-mute">
                Si acumulas mucha deuda, cada sesión coge como mucho estas palabras, empezando por
                las más atrasadas. Evita que un día de descanso se convierta en una sesión
                imposible.
              </p>
              <Btn
                tone="rd"
                size="sm"
                className="mt-3"
                disabled={!resumenRepaso.total}
                onClick={() => {
                  if (window.confirm('¿Borrar todas las fichas de repaso? Perderás el seguimiento de retención.'))
                    clearReviews()
                }}
              >
                <Trash2 size={11} className="mr-1 inline" /> Vaciar el repaso
              </Btn>
            </div>
          </div>
        </Panel>

        {/* ---- Casillero numérico ---- */}
        <Panel className="mt-4">
          <SectionTitle
            icon={Hash}
            right={
              <Btn tone="mute" size="sm" onClick={() => { if (window.confirm('¿Restaurar las 100 palabras por defecto?')) resetPegs() }}>
                Restaurar
              </Btn>
            }
          >
            Casillero numérico (00-99)
          </SectionTitle>
          <p className="mb-3 text-xs leading-relaxed text-mute">
            Cambia las que no te evoquen nada: un casillero ajeno funciona mal. La casilla se pone
            en <span className="text-am">ámbar</span> si la palabra deja de codificar sus dos
            cifras según la tabla fonética; puedes dejarla así si tú la ves clara, pero revísala.
          </p>
          <div className="grid max-h-[420px] grid-cols-2 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-5">
            {pegs.map((palabra, n) => {
              const esperado = String(n).padStart(2, '0')
              const coherente = palabraACasilla(palabra) === esperado
              return (
                <div
                  key={n}
                  className={cx(
                    'flex items-center gap-1.5 rounded-lg border px-2 py-1',
                    coherente ? 'border-line-soft' : 'border-am/50 bg-am/5',
                  )}
                >
                  <span className="font-mono text-[11px] font-bold text-cy">{esperado}</span>
                  <input
                    value={palabra}
                    onChange={(e) => updatePeg(n, e.target.value)}
                    spellCheck={false}
                    className="min-w-0 flex-1 bg-transparent font-mono text-xs text-slate-200 focus:text-cy"
                  />
                </div>
              )
            })}
          </div>
        </Panel>

        {/* ---- Datos ---- */}
        <Panel className="mt-4">
          <SectionTitle icon={Database} right={<Badge tone="mute">LocalStorage</Badge>}>
            Datos y copia de seguridad
          </SectionTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Btn
              tone="mute"
              onClick={() =>
                downloadJSON(`gimnasio-mental-backup-${Date.now()}.json`, {
                  settings,
                  decks,
                  sessions,
                })
              }
            >
              <Download size={11} className="mr-1 inline" /> Exportar todo
            </Btn>
            <Btn tone="mute" onClick={() => importRef.current?.click()}>
              <Upload size={11} className="mr-1 inline" /> Restaurar copia
            </Btn>
            <input
              ref={importRef}
              type="file"
              accept=".json"
              onChange={handleBackupFile}
              className="hidden"
            />
            <span className="font-mono text-[11px] text-mute">
              {sessions.length} sesiones · {decks.length} mazos propios
            </span>
          </div>
        </Panel>
      </div>
    </div>
  )
}
