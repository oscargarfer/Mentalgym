import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { LANGUAGES, loadLanguage } from '../data/languages.js'
import COUNTS from '../data/vocabCounts.json'
import { load, save, snapshot, restore, onSave, KEYS } from '../lib/storage.js'
import { cargarEstado, guardarEstado, guardarAlSalir } from '../lib/sync.js'
import { setSoundEnabled } from '../lib/sound.js'
import { uid } from '../lib/utils.js'
import { INTERVALOS, altaLote, programar, resumen } from '../lib/srs.js'
import { CASILLERO } from '../data/pegs.js'

const DEFAULT_SETTINGS = {
  langId: 'en',
  sound: true,
  showLoadTimer: true,
  intervalos: INTERVALOS,
  topeRepasoDiario: 60,
  // 'auto' sigue al dispositivo; 'si' y 'no' fuerzan los controles táctiles.
  tactil: 'auto',
  // Hasta dónde llega el vocabulario que entra en los ejercicios.
  nivel: 'comun',
}

/** Cuántas palabras del mazo entran en cada nivel. */
const corte = (meta, nivel) => {
  if (nivel === 'nucleo') return meta.nucleo ?? meta.count
  if (nivel === 'comun') return meta.comun ?? meta.count
  return meta.count
}

const AppCtx = createContext(null)

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...load(KEYS.settings, {}),
  }))
  const [decks, setDecks] = useState(() => load(KEYS.decks, []))
  const [sessions, setSessions] = useState(() => load(KEYS.sessions, []))
  // Fichas de repaso espaciado, palacios de la memoria y casillero personalizado
  const [reviews, setReviews] = useState(() => load(KEYS.reviews, []))
  const [palaces, setPalaces] = useState(() => load(KEYS.palaces, []))
  const [pegs, setPegs] = useState(() => load(KEYS.pegs, CASILLERO))
  // Bloquea la navegacion global mientras un modulo esta en ejecucion
  const [locked, setLocked] = useState(false)
  // Vocabulario del idioma activo: se carga bajo demanda
  const [entries, setEntries] = useState([])
  const [deckLoading, setDeckLoading] = useState(true)
  // Hasta leer el progreso del disco no se monta nada, o un módulo podría
  // arrancar con el historial vacío y luego pisarlo al guardar.
  const [hidratado, setHidratado] = useState(false)

  useEffect(() => {
    let cancelado = false
    ;(async () => {
      const enDisco = await cargarEstado()
      if (cancelado) return
      if (enDisco && Object.keys(enDisco).length) {
        restore(enDisco)
        setSettings({ ...DEFAULT_SETTINGS, ...load(KEYS.settings, {}) })
        setDecks(load(KEYS.decks, []))
        setSessions(load(KEYS.sessions, []))
        setReviews(load(KEYS.reviews, []))
        setPalaces(load(KEYS.palaces, []))
        setPegs(load(KEYS.pegs, CASILLERO))
      } else {
        // Primer arranque (o disco vacío): lo que hubiera en el navegador sube a disco
        guardarEstado(snapshot())
      }
      setHidratado(true)
    })()
    return () => {
      cancelado = true
    }
  }, [])

  // Cualquier escritura en localStorage —ajustes, historial, bolsas de reparto—
  // se replica a disco. Al colgarse de storage.save no hay que acordarse de
  // sincronizar cada sitio nuevo que guarde algo.
  useEffect(() => {
    if (!hidratado) return undefined
    onSave(() => guardarEstado(snapshot()))
    return () => onSave(null)
  }, [hidratado])

  // Volcado explícito al terminar de hidratar. `restore()` vacía el espacio de
  // nombres entero, y un estado cuyo valor coincide en referencia con su valor
  // por defecto (el casillero) no dispara su efecto de guardado: sin esto, esa
  // clave se quedaba sin escribir nunca.
  useEffect(() => {
    if (!hidratado) return
    save(KEYS.settings, settings)
    save(KEYS.decks, decks)
    save(KEYS.sessions, sessions)
    save(KEYS.reviews, reviews)
    save(KEYS.palaces, palaces)
    save(KEYS.pegs, pegs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado])

  // Red de seguridad al cerrar la pestaña o el navegador
  useEffect(() => {
    if (!hidratado) return undefined
    const alSalir = () => guardarAlSalir(snapshot())
    const alOcultar = () => {
      if (document.visibilityState === 'hidden') alSalir()
    }
    window.addEventListener('pagehide', alSalir)
    document.addEventListener('visibilitychange', alOcultar)
    return () => {
      window.removeEventListener('pagehide', alSalir)
      document.removeEventListener('visibilitychange', alOcultar)
    }
  }, [hidratado])

  useEffect(() => {
    save(KEYS.settings, settings)
  }, [settings])
  useEffect(() => {
    save(KEYS.decks, decks)
  }, [decks])
  useEffect(() => {
    save(KEYS.sessions, sessions)
  }, [sessions])
  useEffect(() => {
    save(KEYS.reviews, reviews)
  }, [reviews])
  useEffect(() => {
    save(KEYS.palaces, palaces)
  }, [palaces])
  useEffect(() => {
    save(KEYS.pegs, pegs)
  }, [pegs])
  useEffect(() => {
    setSoundEnabled(settings.sound)
  }, [settings.sound])

  /** Catalogo completo sin vocabulario: solo metadatos y recuento. */
  const allDecks = useMemo(
    () => [
      ...LANGUAGES.map((l) => ({
        id: l.id,
        name: l.name,
        tag: l.tag,
        accent: l.accent,
        count: COUNTS[l.id]?.total ?? 0,
        nucleo: COUNTS[l.id]?.nucleo,
        comun: COUNTS[l.id]?.comun,
        custom: false,
      })),
      // Un mazo propio no viene por tramos de frecuencia: entra entero sea cual
      // sea el nivel.
      ...decks.map((d) => ({ ...d, count: d.entries.length, custom: true })),
    ],
    [decks],
  )

  const meta = useMemo(
    () => allDecks.find((d) => d.id === settings.langId) || allDecks[0],
    [allDecks, settings.langId],
  )

  // Carga del mazo activo. `cancelled` evita pisar el estado si el usuario
  // cambia de idioma antes de que resuelva el import anterior.
  useEffect(() => {
    let cancelled = false
    const custom = decks.find((d) => d.id === meta.id)
    if (custom) {
      setEntries(custom.entries)
      setDeckLoading(false)
      return () => {
        cancelled = true
      }
    }
    setDeckLoading(true)
    loadLanguage(meta.id).then((rows) => {
      if (cancelled) return
      setEntries(rows)
      setDeckLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [meta.id, decks])

  /**
   * Mazo activo, recortado al nivel elegido.
   *
   * El mazo conserva el orden en que se construyó: primero el núcleo de
   * frecuencia real, después el vocabulario común y al final la ampliación. Un
   * nivel es por tanto un corte por posición. Sin esto, en la primera sesión
   * salía con la misma probabilidad "hacer" que una palabra que no se usa casi
   * nunca, y el reparto aleatorio hacía el resto.
   */
  const deck = useMemo(() => {
    const tope = corte(meta, settings.nivel)
    const usables = meta.custom ? entries : entries.slice(0, tope)
    return { ...meta, entries: usables, count: usables.length, total: meta.count, loading: deckLoading }
  }, [meta, entries, deckLoading, settings.nivel])

  const update = useCallback((patch) => setSettings((s) => ({ ...s, ...patch })), [])

  const addDeck = useCallback((name, list) => {
    const d = {
      id: `custom-${uid()}`,
      name: name || 'Mazo personalizado',
      tag: (name || 'MX').slice(0, 2).toUpperCase(),
      accent: '#26ff9c',
      entries: list,
      createdAt: Date.now(),
    }
    setDecks((prev) => [...prev, d])
    return d.id
  }, [])

  const removeDeck = useCallback((id) => {
    setDecks((prev) => prev.filter((d) => d.id !== id))
    setSettings((s) => (s.langId === id ? { ...s, langId: 'en' } : s))
  }, [])

  const addSession = useCallback((record) => {
    const full = { id: uid(), ts: Date.now(), ...record }
    setSessions((prev) => [...prev, full])
    return full
  }, [])

  const clearSessions = useCallback(() => setSessions([]), [])

  /* ---------- Repaso espaciado ---------- */

  /** Incorpora al repaso las palabras de un lote recién memorizado. */
  const registrarLote = useCallback(
    (lang, respuestas) =>
      setReviews((prev) => altaLote(prev, lang, respuestas, Date.now(), settings.intervalos)),
    [settings.intervalos],
  )

  /** Reprograma las fichas respondidas en una sesión de repaso. */
  const registrarRepaso = useCallback(
    (resultados) =>
      setReviews((prev) => {
        const porId = new Map(prev.map((f) => [f.id, f]))
        const ahora = Date.now()
        for (const { id, ok } of resultados) {
          const f = porId.get(id)
          if (f) porId.set(id, programar(f, ok, ahora, settings.intervalos))
        }
        return [...porId.values()]
      }),
    [settings.intervalos],
  )

  const clearReviews = useCallback(() => setReviews([]), [])

  const resumenRepaso = useMemo(() => resumen(reviews), [reviews])

  /* ---------- Palacios de la memoria ---------- */

  const addPalace = useCallback((nombre, loci) => {
    const p = { id: `pal-${uid()}`, nombre: nombre || 'Palacio', loci, createdAt: Date.now() }
    setPalaces((prev) => [...prev, p])
    return p.id
  }, [])

  const updatePalace = useCallback(
    (id, patch) => setPalaces((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    [],
  )

  const removePalace = useCallback(
    (id) => setPalaces((prev) => prev.filter((p) => p.id !== id)),
    [],
  )

  /* ---------- Casillero ---------- */

  const updatePeg = useCallback(
    (n, palabra) =>
      setPegs((prev) => {
        const next = [...prev]
        next[n] = palabra
        return next
      }),
    [],
  )

  const resetPegs = useCallback(() => setPegs(CASILLERO), [])

  const importData = useCallback((data) => {
    if (data.settings) setSettings((s) => ({ ...s, ...data.settings }))
    if (Array.isArray(data.decks)) setDecks(data.decks)
    if (Array.isArray(data.sessions)) setSessions(data.sessions)
    if (Array.isArray(data.reviews)) setReviews(data.reviews)
    if (Array.isArray(data.palaces)) setPalaces(data.palaces)
    if (Array.isArray(data.pegs)) setPegs(data.pegs)
  }, [])

  const value = useMemo(
    () => ({
      settings, update, decks, allDecks, deck,
      addDeck, removeDeck, sessions, addSession, clearSessions, importData,
      reviews, registrarLote, registrarRepaso, clearReviews, resumenRepaso,
      palaces, addPalace, updatePalace, removePalace,
      pegs, updatePeg, resetPegs,
      locked, setLocked,
    }),
    [
      settings, update, decks, allDecks, deck, addDeck, removeDeck,
      sessions, addSession, clearSessions, importData,
      reviews, registrarLote, registrarRepaso, clearReviews, resumenRepaso,
      palaces, addPalace, updatePalace, removePalace,
      pegs, updatePeg, resetPegs, locked,
    ],
  )

  if (!hidratado) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-950">
        <span className="font-mono text-[11px] uppercase tracking-[0.35em] text-mute">
          recuperando tu progreso…
        </span>
      </div>
    )
  }

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export const useApp = () => {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>')
  return ctx
}
